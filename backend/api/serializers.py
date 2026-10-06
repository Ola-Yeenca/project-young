from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework import serializers

from apps.core.models import FAQ, City, SiteSettings, Venue
from apps.enquiries.models import BookingEnquiry, ContactEnquiry
from apps.events.models import Event
from apps.gallery.models import Album
from apps.shop.models import Product
from apps.talent.models import Talent


def file_url(request, field):
    if not field:
        return None
    url = field.url
    return request.build_absolute_uri(url) if request and url.startswith("/") else url


class CitySerializer(serializers.ModelSerializer):
    currency_symbol = serializers.CharField(read_only=True)

    class Meta:
        model = City
        fields = (
            "name",
            "slug",
            "country",
            "currency",
            "currency_symbol",
            "timezone",
            "ticket_provider",
            "whatsapp_number",
            "instagram_url",
        )


class CityRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ("name", "slug")


class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = ("name", "slug", "address", "map_url")


class MediaSerializer(serializers.Serializer):
    kind = serializers.CharField()
    image = serializers.SerializerMethodField()
    video_url = serializers.URLField()
    caption = serializers.CharField()

    def get_image(self, obj):
        return file_url(self.context.get("request"), obj.image)


class TalentRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Talent
        fields = ("name", "slug")


class EventSerializer(serializers.ModelSerializer):
    city = CityRefSerializer()
    venue = VenueSerializer()
    poster = serializers.SerializerMethodField()
    local = serializers.SerializerMethodField()
    lineup = serializers.SerializerMethodField()
    ticket_provider = serializers.CharField(source="provider")
    currency = serializers.CharField(source="city.currency")
    currency_symbol = serializers.CharField(source="city.currency_symbol")
    is_free = serializers.BooleanField()
    is_cancelled = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            "title",
            "slug",
            "city",
            "venue",
            "kind",
            "starts_at",
            "ends_at",
            "local",
            "poster",
            "caption",
            "description",
            "lineup",
            "music_style",
            "bpm",
            "ticket_url",
            "ticket_provider",
            "price_from",
            "currency",
            "currency_symbol",
            "is_free",
            "sold_out",
            "sold_percent",
            "age_restriction",
            "is_featured",
            "is_cancelled",
        )

    def get_poster(self, obj):
        return file_url(self.context.get("request"), obj.poster)

    def get_local(self, obj):
        start = timezone.localtime(obj.starts_at, ZoneInfo(obj.city.timezone))
        return {"date": start.strftime("%a %d %b"), "time": start.strftime("%H:%M"), "timezone": obj.city.timezone}

    def get_lineup(self, obj):
        talent = [{"name": t.name, "slug": t.slug} for t in obj.lineup.all() if t.is_published]
        extra = [{"name": n.strip(), "slug": None} for n in obj.lineup_extra.split(",") if n.strip()]
        return talent + extra

    def get_is_cancelled(self, obj):
        return obj.status == Event.Status.CANCELLED


class TalentListSerializer(serializers.ModelSerializer):
    city = CityRefSerializer()
    photo = serializers.SerializerMethodField()
    group = serializers.CharField()

    class Meta:
        model = Talent
        fields = ("name", "slug", "city", "category", "group", "genre", "photo", "booking_available", "is_featured")

    def get_photo(self, obj):
        return file_url(self.context.get("request"), obj.photo)


class TalentDetailSerializer(TalentListSerializer):
    previous_work = serializers.ListField(source="previous_work_list", child=serializers.CharField())
    links = serializers.ListField(child=serializers.DictField())
    media = MediaSerializer(many=True)
    upcoming_events = serializers.SerializerMethodField()

    class Meta(TalentListSerializer.Meta):
        fields = TalentListSerializer.Meta.fields + ("bio", "previous_work", "travels", "links", "media", "upcoming_events")

    def get_upcoming_events(self, obj):
        events = Event.objects.upcoming().filter(lineup=obj).select_related("city")
        return [{"title": e.title, "slug": e.slug, "starts_at": e.starts_at, "city": e.city.slug} for e in events]


class AlbumListSerializer(serializers.ModelSerializer):
    city = CityRefSerializer()
    event = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    cover = serializers.SerializerMethodField()
    item_count = serializers.IntegerField(source="items.count")

    class Meta:
        model = Album
        fields = ("title", "slug", "city", "event", "date", "cover", "item_count")

    def get_cover(self, obj):
        return file_url(self.context.get("request"), obj.cover_image)


class AlbumDetailSerializer(AlbumListSerializer):
    items = MediaSerializer(many=True)

    class Meta(AlbumListSerializer.Meta):
        fields = AlbumListSerializer.Meta.fields + ("items",)


class ProductSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    variants = serializers.SerializerMethodField()
    prices = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ("name", "slug", "description", "material", "fit", "image", "images", "variants", "prices")

    def get_image(self, obj):
        return file_url(self.context.get("request"), obj.image)

    def get_images(self, obj):
        request = self.context.get("request")
        return [{"url": file_url(request, i.image), "alt": i.alt} for i in obj.images.all()]

    def get_variants(self, obj):
        return [{"label": v.label, "in_stock": v.in_stock} for v in obj.variants.all()]

    def get_prices(self, obj):
        city = self.context.get("city")
        prices = [p for p in obj.prices.all() if p.is_available and (city is None or p.city_id == city.id)]
        return [
            {
                "city": p.city.slug,
                "amount": str(p.amount),
                "currency": p.city.currency,
                "currency_symbol": p.city.currency_symbol,
                "checkout_url": p.checkout_url,
            }
            for p in prices
        ]


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ("category", "question", "answer")


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ("tagline", "about", "instagram_url", "tiktok_url", "youtube_url", "show_powered_by")


# ---------- enquiries ----------


class EnquiryCreateMixin(serializers.Serializer):
    website = serializers.CharField(required=False, allow_blank=True, write_only=True, help_text="Leave empty. Spam trap.")
    city = serializers.SlugRelatedField(slug_field="slug", queryset=City.objects.filter(is_active=True), required=False, allow_null=True)
    privacy_accepted = serializers.BooleanField()

    def validate_privacy_accepted(self, value):
        if not value:
            raise serializers.ValidationError("Please accept the privacy policy so we can store your details.")
        return value

    def validate(self, attrs):
        if attrs.get("website"):
            raise serializers.ValidationError("Submission rejected.")
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError({"email": "Give an email address or a phone number so we can reply."})
        attrs.pop("website", None)
        return attrs


class BookingEnquiryCreateSerializer(EnquiryCreateMixin, serializers.ModelSerializer):
    talent = serializers.SlugRelatedField(slug_field="slug", queryset=Talent.objects.published(), required=False, allow_null=True)
    reference = serializers.CharField(read_only=True)

    class Meta:
        model = BookingEnquiry
        fields = (
            "reference",
            "talent",
            "city",
            "client_name",
            "company",
            "email",
            "phone",
            "event_date",
            "event_location",
            "event_type",
            "expected_audience",
            "message",
            "privacy_accepted",
            "website",
        )

    def validate_event_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("The event date is in the past.")
        return value

    def create(self, validated_data):
        talent = validated_data.get("talent")
        if talent and not validated_data.get("city"):
            validated_data["city"] = talent.city
        return super().create(validated_data)


class ContactEnquiryCreateSerializer(EnquiryCreateMixin, serializers.ModelSerializer):
    reference = serializers.CharField(read_only=True)

    class Meta:
        model = ContactEnquiry
        fields = ("reference", "category", "city", "name", "email", "phone", "subject", "message", "privacy_accepted", "website")
