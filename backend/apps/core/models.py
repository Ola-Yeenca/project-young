import unicodedata
from zoneinfo import available_timezones

from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify

from . import content


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Currency(models.TextChoices):
    EUR = "EUR", "Euro (€)"
    NGN = "NGN", "Naira (₦)"
    GBP = "GBP", "Pound (£)"
    USD = "USD", "US dollar ($)"
    GHS = "GHS", "Cedi (₵)"
    KES = "KES", "Kenyan shilling (KSh)"
    ZAR = "ZAR", "Rand (R)"
    XOF = "XOF", "West African CFA franc (CFA)"
    MAD = "MAD", "Moroccan dirham (DH)"
    EGP = "EGP", "Egyptian pound (E£)"
    AED = "AED", "UAE dirham (AED)"
    CAD = "CAD", "Canadian dollar (C$)"


CURRENCY_SYMBOLS = {
    "EUR": "€",
    "NGN": "₦",
    "GBP": "£",
    "USD": "$",
    "GHS": "₵",
    "KES": "KSh ",
    "ZAR": "R",
    "XOF": "CFA ",
    "MAD": "DH ",
    "EGP": "E£",
    "AED": "AED ",
    "CAD": "C$",
}


def normalize_catalog_name(value):
    """Return the stable duplicate-detection key used by small shared catalogs."""

    return " ".join(unicodedata.normalize("NFKC", value or "").split()).casefold()


class MusicStyle(TimeStampedModel):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    normalized_name = models.CharField(max_length=120, unique=True, editable=False)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:120] or "style"
            candidate = base
            suffix = 2
            existing = type(self).objects.exclude(pk=self.pk)
            while existing.filter(slug=candidate).exists():
                marker = f"-{suffix}"
                candidate = f"{base[: 120 - len(marker)]}{marker}"
                suffix += 1
            self.slug = candidate
        self.full_clean()
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        display_name = " ".join(unicodedata.normalize("NFKC", self.name or "").split())
        if not display_name:
            raise ValidationError({"name": "Enter a music style."})
        normalized_name = normalize_catalog_name(display_name)
        if len(display_name) > 120 or len(normalized_name) > 120:
            raise ValidationError({"name": "Ensure the normalized music style has at most 120 characters."})
        self.name = display_name
        self.normalized_name = normalized_name
        duplicate = type(self).objects.exclude(pk=self.pk).filter(normalized_name=self.normalized_name)
        if duplicate.exists():
            raise ValidationError({"name": "A music style with this name already exists."})


def validate_timezone(value):
    if value not in available_timezones():
        raise ValidationError(f"“{value}” is not a known time zone. Use a name like Europe/Madrid or Africa/Lagos.")


class City(TimeStampedModel):
    """A market HOY operates in. Adding a new city is one row here."""

    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    country = models.CharField(max_length=80)
    currency = models.CharField(max_length=3, choices=Currency.choices)
    timezone = models.CharField(max_length=64, validators=[validate_timezone], help_text="For example Europe/Madrid or Africa/Lagos.")
    ticket_provider = models.CharField(
        max_length=80, blank=True, help_text="Default ticket partner for this city, e.g. Fourvenues or Tix.africa."
    )
    whatsapp_number = models.CharField(max_length=32, blank=True, help_text="Shown on the site for this city, in international format.")
    instagram_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True, help_text="Untick to hide the city and everything in it from the site.")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ("order", "name")
        verbose_name_plural = "cities"

    def __str__(self):
        return self.name

    @property
    def currency_symbol(self):
        return CURRENCY_SYMBOLS.get(self.currency, self.currency)


class Venue(TimeStampedModel):
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="venues")
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120)
    address = models.CharField(max_length=255, blank=True)
    map_url = models.URLField(blank=True, help_text="Google Maps or Apple Maps link.")
    capacity = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ("city", "name")
        constraints = [models.UniqueConstraint(fields=["city", "slug"], name="unique_venue_slug_per_city")]

    def __str__(self):
        return f"{self.name}, {self.city}"


class MediaKind(models.TextChoices):
    PHOTO = "photo", "Photo"
    VIDEO = "video", "Video (link)"


class MediaBase(models.Model):
    """A photo upload or a video link (YouTube, Instagram, Vimeo, TikTok)."""

    kind = models.CharField(max_length=5, choices=MediaKind.choices, default=MediaKind.PHOTO)
    image = models.ImageField(upload_to="media/%Y/%m/", blank=True, help_text="Required for photos. Optional thumbnail for videos.")
    video_url = models.URLField(blank=True, help_text="Required for videos.")
    caption = models.CharField(max_length=200, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        abstract = True
        ordering = ("order", "id")

    def clean(self):
        super().clean()
        if self.kind == MediaKind.PHOTO and not self.image:
            raise ValidationError({"image": "Upload a photo, or change the type to Video."})
        if self.kind == MediaKind.VIDEO and not self.video_url:
            raise ValidationError({"video_url": "Paste the video link, or change the type to Photo."})


class FAQ(TimeStampedModel):
    class Category(models.TextChoices):
        GENERAL = "general", "General"
        TICKETS = "tickets", "Events and tickets"
        TALENT = "talent", "Talent bookings"
        COLLABORATION = "collaboration", "Collaborations"
        SHOP = "shop", "Shop"
        OTHER = "other", "Other"

    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    question = models.CharField(max_length=255)
    answer = models.TextField()
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ("order", "id")
        verbose_name = "FAQ"
        verbose_name_plural = "FAQs"

    def __str__(self):
        return self.question


class SiteSettings(models.Model):
    """One row of site-wide content the team can edit without a developer."""

    tagline = models.CharField("motto", max_length=200, default=content.MOTTO, help_text="Shown on the homepage and in the footer.")
    intro = models.TextField("homepage introduction", blank=True, default=content.INTRO)
    about = models.TextField(
        blank=True, help_text="About House of Young, on the homepage and the Contact page. Blank lines start new paragraphs."
    )
    vision = models.TextField("our vision", blank=True, default=content.VISION)
    community = models.TextField("our community", blank=True, default=content.COMMUNITY)
    business_enabled = models.BooleanField(
        "business section live", default=False, help_text="Shows the Business page and its menu link. Leave off until its content is ready."
    )
    contact_email = models.EmailField(blank=True, help_text="Receives contact form messages.")
    booking_email = models.EmailField(blank=True, help_text="Receives talent booking enquiries. Falls back to the contact email.")
    instagram_url = models.URLField(blank=True)
    tiktok_url = models.URLField(blank=True)
    youtube_url = models.URLField(blank=True)
    show_powered_by = models.BooleanField(default=True, help_text="Show “Powered by SME Analytica” in the footer.")

    class Meta:
        verbose_name = "site settings"
        verbose_name_plural = "site settings"

    def __str__(self):
        return "Site settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Site settings cannot be deleted.")

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
