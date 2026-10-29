from django.db import models

from apps.core.models import City, TimeStampedModel
from apps.events.models import Event


class TasteAnswer(TimeStampedModel):
    """What one guest wants to hear at one event. Anonymous: no name, email or address is kept."""

    class Source(models.TextChoices):
        TICKET = "ticket", "After buying tickets"
        QR = "qr", "QR code at the venue"

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="taste_answers")
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="taste_answers")
    source = models.CharField(max_length=6, choices=Source.choices)
    visitor = models.CharField(max_length=16, help_text="Keyed hash of the browser's random answer token.")
    genres = models.JSONField(default=list, blank=True, help_text="Up to three music style slugs.")
    artist = models.CharField("favourite artist", max_length=80, blank=True)
    song = models.CharField("song request", max_length=120, blank=True)
    song_hidden = models.BooleanField(default=False, help_text="Hidden from the DJ board as unsuitable.")

    class Meta:
        ordering = ("-updated_at",)
        constraints = [models.UniqueConstraint(fields=["event", "visitor", "source"], name="one_taste_answer_per_visitor_and_source")]
        indexes = [models.Index(fields=["city", "created_at"])]
        permissions = [("manage_djs", "Can create and switch off DJ logins")]

    def __str__(self):
        return f"{self.event} · {self.get_source_display()}"
