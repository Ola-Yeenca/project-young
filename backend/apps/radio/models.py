from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models

from apps.core.models import City, TimeStampedModel

MAX_MB = 30


def audio_size(f):
    if f.size > MAX_MB * 1024 * 1024:
        raise ValidationError(f"Keep tracks under {MAX_MB} MB. Export as MP3 at 192 to 320 kbps.")


class TrackQuerySet(models.QuerySet):
    def published(self):
        return self.filter(is_published=True)


class Track(TimeStampedModel):
    """A track HOY Radio can play. Each genre is one of the site's grooves."""

    class Genre(models.TextChoices):
        AFROBEATS = "afrobeats", "Afrobeats"
        AMAPIANO = "amapiano", "Amapiano"
        AFROHOUSE = "afrohouse", "Afrohouse"
        TECHNO = "techno", "Techno"
        HOUSE = "house", "House"
        REGGAETON = "reggaeton", "Reggaeton"

    title = models.CharField(max_length=120)
    artist = models.CharField(max_length=120)
    genre = models.CharField(max_length=12, choices=Genre.choices)
    city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, blank=True, related_name="+", help_text="Empty plays it in every city."
    )
    file = models.FileField(upload_to="radio/", validators=[FileExtensionValidator(["mp3", "m4a", "aac", "ogg", "wav"]), audio_size])
    rights = models.CharField(
        "permission",
        max_length=240,
        help_text="Who allowed HOY to stream this, and when. For example: Artist's own track, OK'd by email on 12 Oct.",
    )
    is_published = models.BooleanField("on air", default=True)

    objects = TrackQuerySet.as_manager()

    class Meta:
        ordering = ("genre", "artist", "title")

    def __str__(self):
        return f"{self.title} by {self.artist}"
