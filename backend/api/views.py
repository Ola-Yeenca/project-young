from django.db import connection, transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.models import FAQ, City, SiteSettings
from apps.enquiries.notifications import notify
from apps.events.models import Event
from apps.gallery.models import Album, AlbumItem
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
        return qs.select_related("city", "venue").prefetch_related("lineup")


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
            .prefetch_related(Prefetch("items", queryset=AlbumItem.objects.order_by("order", "id")))
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


class FAQList(generics.ListAPIView):
    serializer_class = s.FAQSerializer
    queryset = FAQ.objects.filter(is_published=True)
    pagination_class = None


@api_view(["GET"])
@permission_classes([AllowAny])
def site(request):
    return Response(s.SiteSettingsSerializer(SiteSettings.load()).data)


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
