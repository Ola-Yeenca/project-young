from io import StringIO

from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.core import content
from apps.core.models import FAQ, SiteSettings
from apps.enquiries.models import ContactEnquiry

from .base import HOYTestCase


class SiteContentTests(HOYTestCase):
    def setUp(self):
        self.api = APIClient()

    def test_site_endpoint_serves_homepage_copy_and_keeps_business_off(self):
        data = self.api.get("/api/v1/site/").json()
        self.assertEqual(data["intro"], content.INTRO)
        self.assertEqual(data["vision"], content.VISION)
        self.assertEqual(data["community"], content.COMMUNITY)
        self.assertIs(data["business_enabled"], False)

    def test_site_endpoint_serves_company_details_but_not_inboxes(self):
        SiteSettings.objects.update_or_create(
            pk=1, defaults=dict(legal_name="House of Young S.L.", privacy_email="privacy@hoy.example", contact_email="inbox@hoy.example")
        )
        data = self.api.get("/api/v1/site/").json()
        self.assertEqual(data["legal_name"], "House of Young S.L.")
        self.assertEqual(data["privacy_email"], "privacy@hoy.example")
        self.assertEqual((data["tax_id"], data["legal_address"], data["registry_details"]), ("", "", ""))
        self.assertNotIn("contact_email", data)
        self.assertNotIn("booking_email", data)

    def test_contact_accepts_the_brief_categories(self):
        for category in ("general", "events", "talent", "business", "merchandise", "other"):
            cache.clear()
            r = self.api.post(
                "/api/v1/enquiries/contact/",
                {
                    "category": category,
                    "name": "Ada",
                    "email": "ada@x.example",
                    "subject": "Hello",
                    "message": "Hi",
                    "privacy_accepted": True,
                },
                format="json",
            )
            self.assertEqual(r.status_code, 201, category)
        self.assertEqual(ContactEnquiry.objects.filter(category="merchandise").get().subject, "Hello")

    def test_load_site_content_replaces_only_old_sample_copy(self):
        SiteSettings.objects.update_or_create(pk=1, defaults=dict(tagline=content.OLD_TAGLINE, about=content.OLD_ABOUT))
        old_q, old_a = next(iter(content.SUPERSEDED_FAQS.items()))
        sample = FAQ.objects.create(question=old_q, answer=old_a)
        edited = FAQ.objects.create(question="Press and media", answer="Email press@hoy.example.")

        call_command("load_site_content", stdout=StringIO())
        call_command("load_site_content", stdout=StringIO())

        site = SiteSettings.load()
        self.assertEqual(site.tagline, content.MOTTO)
        self.assertEqual(site.about, content.ABOUT)
        sample.refresh_from_db()
        edited.refresh_from_db()
        self.assertFalse(sample.is_published)
        self.assertTrue(edited.is_published)
        published = list(FAQ.objects.filter(is_published=True).exclude(pk=edited.pk).values_list("question", flat=True))
        self.assertEqual(published, [q for _, q, _ in content.FAQS])

    def test_load_site_content_keeps_edited_settings(self):
        SiteSettings.objects.update_or_create(pk=1, defaults=dict(tagline="Our own line", about="Our own story"))
        call_command("load_site_content", stdout=StringIO())
        site = SiteSettings.load()
        self.assertEqual((site.tagline, site.about), ("Our own line", "Our own story"))
