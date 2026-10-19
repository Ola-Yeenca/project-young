from django.db import models

from apps.core.models import City, TimeStampedModel

INTERESTS = {
    "events": "Events",
    "talent": "Talent opportunities",
    "business": "Business collaboration",
    "merch": "Merch drops",
}


class MemberQuerySet(models.QuerySet):
    def subscribed(self):
        return self.filter(unsubscribed_at__isnull=True)


class Member(TimeStampedModel):
    """Someone who joined the HOY community list from the site and agreed to hear from us."""

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        WHATSAPP = "whatsapp", "WhatsApp"
        BOTH = "both", "Email and WhatsApp"

    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name="+", help_text="Empty means elsewhere.")
    instagram = models.CharField(max_length=30, blank=True, help_text="Handle without the @.")
    channel = models.CharField("prefers", max_length=10, choices=Channel.choices, default=Channel.EMAIL)
    events = models.BooleanField(default=False)
    talent = models.BooleanField(default=False)
    business = models.BooleanField(default=False)
    merch = models.BooleanField(default=False)
    consent_at = models.DateTimeField(help_text="When they agreed to receive community messages.")
    unsubscribed_at = models.DateTimeField(null=True, blank=True)

    objects = MemberQuerySet.as_manager()

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "community member"

    def __str__(self):
        return f"{self.name} <{self.email}>"

    @property
    def interests(self):
        return [label for key, label in INTERESTS.items() if getattr(self, key)]
