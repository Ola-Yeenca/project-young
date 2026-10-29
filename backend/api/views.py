from django.db import connection, transaction
from django.db.models import Prefetch
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.models import FAQ, City, SiteSettings
from apps.core.net import client_ip
from apps.core.visitors import visitor_key
from apps.crowd import taste
from apps.enquiries.notifications import notify
from apps.events.models import Event
from apps.gallery.models import Album, AlbumItem, PhotoHit
from apps.gallery.stamp import stamped
from apps.gallery.stats import record
from apps.radio.models import Track
from apps.shop.models import Product, ProductPrice
from apps.talent.models import Talent

from . import serializers as s


def city_from(request):
    slug = request.query_params.get("city")
    if not slug:
        return None
    return get_object_or_404(City, slug=slug, is_active=True)


def truthy(value):
    return str(value).lower() in {"1", "true", "yes"}


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = s.CitySerializer
    queryset = City.objects.filter(is_active=True)
    lookup_field = "slug"
    pagination_class = None


class EventViewSet(viewsets.ReadOnlyModelViewSet):
    """Events. Filters: ?city=valencia &when=upcoming|past|all &featured=1 &kind=club"""

    serializer_class = s.EventSerializer
    lookup_field = "slug"

    def get_queryset(self):
        params = self.request.query_params
        when = params.get("when", "upcoming")
        qs = {"past": Event.objects.past(), "all": Event.objects.published()}.get(when, Event.objects.upcoming())
        if self.action == "retrieve":
            qs = Event.objects.published()
        if city := city_from(self.request):
            qs = qs.filter(city=city)
        if truthy(params.get("featured")):
            qs = qs.filter(is_featured=True).order_by("featured_order", "starts_at")
        if kind := params.get("kind"):
            qs = qs.filter(kind=kind)
        return qs.select_related("city", "venue", "ticketing_mapping").prefetch_related("lineup")


class TalentViewSet(viewsets.ReadOnlyModelViewSet):
    """Talent. Filters: ?city=lagos &group=DJs|Live|Hosts &category=dj &featured=1"""

    lookup_field = "slug"

    def get_serializer_class(self):
        return s.TalentDetailSerializer if self.action == "retrieve" else s.TalentListSerializer

    def get_queryset(self):
        params = self.request.query_params
        qs = Talent.objects.published().select_related("city").prefetch_related("media")
        if city := city_from(self.request):
            qs = qs.filter(city=city)
        if truthy(params.get("featured")):
            qs = qs.filter(is_featured=True).order_by("featured_order", "name")
        if category := params.get("category"):
            qs = qs.filter(category=category)
        if group := params.get("group"):
            qs = qs.filter(category__in=[c for c, g in Talent.GROUPS.items() if g.lower() == group.lower()])
        return qs


class AlbumViewSet(viewsets.ReadOnlyModelViewSet):
    """Gallery albums. Filters: ?city=valencia &event=<event-slug>"""

    lookup_field = "slug"

    def get_serializer_class(self):
        return s.AlbumDetailSerializer if self.action == "retrieve" else s.AlbumListSerializer

    def get_queryset(self):
        qs = (
            Album.objects.published()
            .select_related("city", "event")
            .prefetch_related(
                Prefetch(
                    "items",
                    queryset=AlbumItem.objects.filter(is_published=True).order_by("order", "id"),
                    to_attr="published_items",
                )
            )
        )
        if city := city_from(self.request):
            qs = qs.filter(city=city)
        if event := self.request.query_params.get("event"):
            qs = qs.filter(event__slug=event)
        return qs


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Merch. ?city=lagos returns only products sold there, priced in naira."""

    serializer_class = s.ProductSerializer
    lookup_field = "slug"

    def get_queryset(self):
        city = city_from(self.request)
        qs = Product.objects.for_city(city) if city else Product.objects.published()
        return qs.prefetch_related("variants", "images", Prefetch("prices", queryset=ProductPrice.objects.select_related("city")))

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "city": city_from(self.request)}


class TrackList(generics.ListAPIView):
    """HOY Radio tracks that are on air. The site shuffles them per visit."""

    serializer_class = s.TrackSerializer
    queryset = Track.objects.published().select_related("city")
    pagination_class = None


class FAQList(generics.ListAPIView):
    serializer_class = s.FAQSerializer
    queryset = FAQ.objects.filter(is_published=True)
    pagination_class = None


@api_view(["GET"])
@permission_classes([AllowAny])
def site(request):
    return Response(s.SiteSettingsSerializer(SiteSettings.load(), context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return Response({"status": "ok"})


class EnquiryCreate(generics.GenericAPIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "enquiries"

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Only the reference goes back: no need to echo personal data.
        return Response({"reference": serializer.instance.reference, "status": "received"}, status=201)

    def perform_create(self, serializer):
        enquiry = serializer.save()
        transaction.on_commit(lambda: notify(enquiry))


class BookingEnquiryCreate(EnquiryCreate):
    serializer_class = s.BookingEnquiryCreateSerializer


class ContactEnquiryCreate(EnquiryCreate):
    serializer_class = s.ContactEnquiryCreateSerializer


class CommunityJoin(generics.GenericAPIView):
    serializer_class = s.CommunityJoinSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "enquiries"

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"status": "joined"}, status=201)


def published_photo(pk):
    return get_object_or_404(
        AlbumItem.objects.select_related("album__city", "album__event").exclude(image=""),
        pk=pk,
        kind="photo",
        is_published=True,
        album__is_published=True,
        album__city__is_active=True,
    )


class PhotoView(generics.GenericAPIView):
    """Count a photo opened full screen. Body: {"device": <sha-256 hex, only with consent>}"""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "photos"

    def post(self, request, pk):
        item = published_photo(pk)
        record(item, PhotoHit.Kind.VIEW, request, str(request.data.get("device", "")))
        item.refresh_from_db(fields=("views", "downloads"))
        return Response({"views": item.views, "downloads": item.downloads})


class PhotoDownload(generics.GenericAPIView):
    """The credited JPEG of a photo, counted as a download. ?d=<device hash, only with consent>"""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "photos"

    def get(self, request, pk):
        item = published_photo(pk)
        record(item, PhotoHit.Kind.DOWNLOAD, request, request.query_params.get("d", ""))
        response = HttpResponse(stamped(item), content_type="image/jpeg")
        response["Content-Disposition"] = f'attachment; filename="hoy-{item.album.slug}-{item.pk}.jpg"'
        response["Cache-Control"] = "no-store"
        return response


class CrowdThrottle(ScopedRateThrottle):
    def get_ident(self, request):
        return client_ip(request)


class EventTaste(generics.GenericAPIView):
    """What the crowd wants to hear. GET: genre choices and shares (never free text).
    POST {token, source: ticket|qr, genres: [slug ≤3], artist, song}: one anonymous answer per browser and source.
    """

    serializer_class = s.TasteAnswerSerializer
    throttle_scope = "crowd"

    def get_throttles(self):
        # The room page polls GET; only answers are rate limited.
        return [CrowdThrottle()] if self.request.method == "POST" else []

    def get(self, request, slug):
        return Response(taste.summary(get_object_or_404(Event.objects.published(), slug=slug)))

    def post(self, request, slug):
        event = get_object_or_404(Event.objects.published(), slug=slug)
        if event.status == Event.Status.CANCELLED:
            return Response({"detail": "This event was cancelled."}, status=400)
        if not taste.is_open(event):
            return Response({"detail": "Answers for this night are closed."}, status=400)
        options = {style for style, _ in taste.genre_options(event)}
        serializer = self.get_serializer(data=request.data, context={**self.get_serializer_context(), "options": options})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        _, created = taste.save_answer(
            event,
            visitor_key("taste", str(event.pk), data["token"]),
            data["source"],
            genres=data.get("genres", []),
            artist=data.get("artist", ""),
            song=data.get("song", ""),
        )
        return Response({"status": "saved", **taste.summary(event)}, status=201 if created else 200)
