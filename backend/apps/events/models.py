from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator
from django.db import models
from django.utils import timezone

from apps.core.models import City, TimeStampedModel, Venue
from apps.talent.models import Talent


class EventQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status__in=[Event.Status.PUBLISHED, Event.Status.CANCELLED], city__is_active=True)

    def upcoming(self):
        return self.published().filter(starts_at__gte=timezone.now() - timezone.timedelta(hours=6)).order_by("starts_at")

    def past(self):
        return self.published().filter(starts_at__lt=timezone.now() - timezone.timedelta(hours=6)).order_by("-starts_at")

    def featured(self):
        return self.upcoming().filter(is_featured=True).order_by("featured_order", "starts_at")


class Event(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CANCELLED = "cancelled", "Cancelled"

    class Kind(models.TextChoices):
        CLUB = "club", "Club night"
        LIVE = "live", "Live show"
        DAY = "day", "Day party"
        FESTIVAL = "festival", "Festival"
        TALK = "talk", "Talk / mixer"
        PRIVATE = "private", "Private event"

    class Style(models.TextChoices):
        AFROBEATS = "afrobeats", "Afrobeats"
        AMAPIANO = "amapiano", "Amapiano"
        HIGHLIFE = "highlife", "Highlife"
        MIXED = "mixed", "Mixed"

    title = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="events")
    venue = models.ForeignKey(Venue, on_delete=models.PROTECT, related_name="events")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.CLUB)
    starts_at = models.DateTimeField(help_text="Doors open. Entered in the event city's local time.")
    ends_at = models.DateTimeField(null=True, blank=True)

    poster = models.ImageField(upload_to="events/", blank=True, help_text="Artwork or poster. Square or portrait.")
    caption = models.CharField(
        max_length=160, blank=True, help_text="One line for the homepage, e.g. “Log drums, salt air, an early finish.”"
    )
    description = models.TextField(blank=True)
    lineup = models.ManyToManyField(Talent, blank=True, related_name="events", help_text="HOY talent playing.")
    lineup_extra = models.CharField(max_length=255, blank=True, help_text="Other names, comma separated, e.g. “Special guest”.")
    music_style = models.CharField(max_length=20, choices=Style.choices, default=Style.AFROBEATS)
    bpm = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MaxValueValidator(200)], help_text="Tempo for the homepage record player."
    )

    ticket_url = models.URLField(blank=True, help_text="Fourvenues, Tix.africa or other ticket page.")
    ticket_provider = models.CharField(max_length=80, blank=True, help_text="Leave blank to use the city's default.")
    price_from = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, help_text="0 for free entry. Leave blank if not announced."
    )
    sold_out = models.BooleanField(default=False)
    sold_percent = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MaxValueValidator(100)], help_text="Optional. Shows a “% sold” bar."
    )
    age_restriction = models.CharField(max_length=20, default="18+", blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    is_featured = models.BooleanField(default=False, help_text="Put it on the homepage record player.")
    featured_order = models.PositiveSmallIntegerField(default=0, help_text="Lower numbers show first.")

    objects = EventQuerySet.as_manager()

    class Meta:
        ordering = ("starts_at",)
        indexes = [models.Index(fields=["status", "starts_at"]), models.Index(fields=["city", "starts_at"])]

    def __str__(self):
        return f"{self.title} ({self.city})" if self.city_id else self.title

    def clean(self):
        super().clean()
        errors = {}
        if self.venue_id and self.city_id and self.venue.city_id != self.city_id:
            errors["venue"] = f"{self.venue.name} is in {self.venue.city}, not {self.city}."
        if self.ends_at and self.starts_at and self.ends_at <= self.starts_at:
            errors["ends_at"] = "The end time must be after the start time."
        if self.status == self.Status.PUBLISHED and not self.is_free and not self.sold_out and not self.ticket_url:
            errors["ticket_url"] = "Add a ticket link before publishing, or set the price to 0 for free entry."
        if errors:
            raise ValidationError(errors)

    @property
    def is_free(self):
        return self.price_from is not None and self.price_from == 0

    @property
    def is_past(self):
        return self.starts_at < timezone.now() - timezone.timedelta(hours=6)

    @property
    def provider(self):
        return self.ticket_provider or (self.city.ticket_provider if self.city_id else "")

    @property
    def local_starts_at(self):
        from zoneinfo import ZoneInfo

        return timezone.localtime(self.starts_at, ZoneInfo(self.city.timezone))

    @property
    def lineup_names(self):
        names = [t.name for t in self.lineup.all()]
        names += [n.strip() for n in self.lineup_extra.split(",") if n.strip()]
        return names
