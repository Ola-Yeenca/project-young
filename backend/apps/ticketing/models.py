import uuid

from django.db import models


class EventMapping(models.Model):
    """An explicit local inventory link; editorial saves never provision commerce."""

    event = models.OneToOneField("events.Event", on_delete=models.PROTECT, related_name="ticketing_mapping")
    source_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organizer_id = models.CharField(max_length=200)
    commerce_event_id = models.CharField(max_length=200, blank=True)
    payload = models.JSONField(default=dict)
    enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organizer_id", "commerce_event_id"],
                condition=~models.Q(commerce_event_id=""),
                name="ticketing_unique_local_inventory",
            ),
        ]

    def __str__(self):
        return str(self.event)
