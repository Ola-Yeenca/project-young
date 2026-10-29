from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.urls import reverse

from apps.events.models import Event
from apps.events.ticket_links import usable_ticket_url

from . import factories as f
from .base import HOYTestCase

INVALID_LINKS = (
    "",
    "https://example.com/tickets",
    "https://sub.example.org/tickets",
    "https://EXAMPLE.NET./tickets",
    "https://tickets.example/tickets",
    "https://checkout.test/tickets",
    "https://checkout.invalid/tickets",
    "https://checkout.local/tickets",
    "https://localhost.localdomain/tickets",
    "https://127.0.0.1/tickets",
    "https://[::1]/tickets",
    "https://2130706433/tickets",
    "http://tickets.fixture-provider.com/events/night",
    "https://user:password@tickets.fixture-provider.com/events/night",
    "/tickets/local-fixture/",
    "javascript:alert(1)",
)
VALID_LINK = "https://www.fourvenues.com/en/fixture-organizer/events/fixture-event"


class TicketLinkReadinessTests(HOYTestCase):
    def setUp(self):
        self.city = f.city()
        self.event = f.event(self.city)
        self.client.force_login(get_user_model().objects.create_superuser("boss", "boss@hoy.example", "test-password"))

    def test_placeholder_local_and_non_https_links_are_unusable(self):
        for url in INVALID_LINKS:
            with self.subTest(url=url):
                self.assertFalse(usable_ticket_url(url))
                self.event.ticket_url = url
                with self.assertRaises(ValidationError) as caught:
                    self.event.full_clean()
                self.assertIn("ticket_url", caught.exception.message_dict)

    def test_provider_shaped_https_link_is_usable_without_network_verification(self):
        self.event.ticket_url = VALID_LINK
        self.assertTrue(self.event.has_usable_ticket_link)
        self.event.full_clean()

    def test_draft_without_valid_link_can_still_be_prepared(self):
        self.event.status = Event.Status.DRAFT
        self.event.ticket_url = "https://example.com/tickets"
        self.event.full_clean()

    def test_sold_out_event_without_link_keeps_existing_publish_rule(self):
        self.event.ticket_url = ""
        self.event.sold_out = True
        self.event.full_clean()

    def test_overview_flags_placeholder_link_and_clears_after_usable_link(self):
        self.event.ticket_url = "https://example.com/tickets"
        self.event.save()
        response = self.client.get(reverse("studio:overview"))
        self.assertContains(response, "has no usable ticket link")
        self.event.ticket_url = VALID_LINK
        self.event.save()
        self.assertNotContains(self.client.get(reverse("studio:overview")), "has no usable ticket link")

    def test_publish_toggle_rejects_placeholder_and_allows_usable_link(self):
        self.event.status = Event.Status.DRAFT
        self.event.ticket_url = "https://example.com/tickets"
        self.event.save()
        url = reverse("studio:event_toggle", args=[self.event.pk, "publish"])
        self.client.post(url)
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, Event.Status.DRAFT)
        self.event.ticket_url = VALID_LINK
        self.event.save()
        self.client.post(url)
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, Event.Status.PUBLISHED)
