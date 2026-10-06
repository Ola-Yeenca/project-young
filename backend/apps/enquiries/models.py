from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import City, TimeStampedModel
from apps.talent.models import Talent


class EnquiryBase(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_PROGRESS = "in_progress", "In progress"
        WAITING = "waiting", "Waiting on client"
        WON = "won", "Confirmed / won"
        LOST = "lost", "Declined / lost"
        CLOSED = "closed", "Closed"
        SPAM = "spam", "Spam"

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW, db_index=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    internal_notes = models.TextField(blank=True, help_text="Only visible to the HOY team.")
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    privacy_accepted = models.BooleanField(default=False)

    class Meta:
        abstract = True
        ordering = ("-created_at",)

    def clean(self):
        super().clean()
        if not self.email and not self.phone:
            raise ValidationError("Give an email address or a phone number so we can reply.")

    @property
    def reference(self):
        prefix = "BK" if isinstance(self, BookingEnquiry) else "CT"
        return f"HOY-{prefix}-{self.created_at:%y}{self.pk:04d}" if self.pk and self.created_at else ""


class BookingEnquiry(EnquiryBase):
    class EventType(models.TextChoices):
        CONCERT = "concert", "Concert / show"
        CLUB = "club", "Club night"
        PRIVATE = "private", "Private party"
        CORPORATE = "corporate", "Corporate / brand"
        WEDDING = "wedding", "Wedding"
        FESTIVAL = "festival", "Festival"
        OTHER = "other", "Other"

    class Audience(models.TextChoices):
        UNDER_100 = "lt100", "Under 100"
        UP_TO_300 = "100-300", "100 to 300"
        UP_TO_1000 = "300-1000", "300 to 1,000"
        OVER_1000 = "gt1000", "Over 1,000"

    talent = models.ForeignKey(Talent, on_delete=models.SET_NULL, null=True, blank=True, related_name="enquiries")
    client_name = models.CharField(max_length=120)
    company = models.CharField(max_length=120, blank=True)
    event_date = models.DateField()
    event_location = models.CharField(max_length=200)
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    expected_audience = models.CharField(max_length=10, choices=Audience.choices)
    message = models.TextField(blank=True)

    class Meta(EnquiryBase.Meta):
        verbose_name = "booking enquiry"
        verbose_name_plural = "booking enquiries"

    def __str__(self):
        who = self.talent.name if self.talent_id else "any act"
        return f"{self.client_name} → {who} on {self.event_date:%d %b %Y}"


class ContactEnquiry(EnquiryBase):
    class Category(models.TextChoices):
        GENERAL = "general", "General enquiry"
        TALENT = "talent", "Talent booking"
        COLLABORATION = "collaboration", "Event collaboration"
        BUSINESS = "business", "Business enquiry"
        PRESS = "press", "Media / press"
        OTHER = "other", "Other"

    category = models.CharField(max_length=20, choices=Category.choices, default=Category.GENERAL)
    name = models.CharField(max_length=120)
    subject = models.CharField(max_length=160, blank=True)
    message = models.TextField()

    class Meta(EnquiryBase.Meta):
        verbose_name = "contact message"
        verbose_name_plural = "contact messages"

    def __str__(self):
        return f"{self.name} · {self.get_category_display()}"
