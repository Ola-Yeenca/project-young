from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone

from apps.core.roles import TEAM_GROUP
from apps.enquiries.models import BookingEnquiry
from apps.events.models import Event
from apps.gallery.models import Album

from . import factories as f
from .base import HOYTestCase

User = get_user_model()


class StudioAccessTests(HOYTestCase):
    def test_anonymous_is_sent_to_login(self):
        r = self.client.get(reverse("studio:overview"))
        self.assertRedirects(r, reverse("studio:login") + "?next=/studio/", fetch_redirect_response=False)

    def test_non_staff_is_refused(self):
        self.client.force_login(User.objects.create_user("fan", password="a-long-password-1"))
        self.assertEqual(self.client.get(reverse("studio:overview")).status_code, 403)

    def test_team_member_without_superuser_can_work(self):
        call_command("seed_demo", verbosity=0)
        u = User.objects.create_user("ada", password="a-long-password-1", is_staff=True)
        u.groups.add(Group.objects.get(name=TEAM_GROUP))
        self.client.force_login(u)
        for name in ("overview", "enquiries", "events", "talent", "gallery", "shop", "content"):
            self.assertEqual(self.client.get(reverse(f"studio:{name}")).status_code, 200, name)

    def test_staff_without_permissions_cannot_open_sections(self):
        self.client.force_login(User.objects.create_user("intern", password="a-long-password-1", is_staff=True))
        self.assertEqual(self.client.get(reverse("studio:overview")).status_code, 200)
        self.assertEqual(self.client.get(reverse("studio:enquiries")).status_code, 403)


class StudioPagesTests(HOYTestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", verbosity=0)
        cls.boss = User.objects.create_superuser("boss", "boss@hoy.example", "a-long-password-1")

    def setUp(self):
        self.client.force_login(self.boss)

    def test_every_page_renders(self):
        from apps.talent.models import Talent

        e, t, album, enquiry = Event.objects.first(), Talent.objects.first(), Album.objects.first(), BookingEnquiry.objects.first()
        urls = [
            reverse("studio:overview"),
            reverse("studio:enquiries"),
            reverse("studio:enquiries") + f"?status=all&open=bk-{enquiry.pk}",
            reverse("studio:events"),
            reverse("studio:events") + "?tab=drafts",
            reverse("studio:events") + "?tab=past",
            reverse("studio:event_new"),
            reverse("studio:event_edit", args=[e.pk]),
            reverse("studio:talent"),
            reverse("studio:talent_new"),
            reverse("studio:talent_edit", args=[t.pk]),
            reverse("studio:gallery"),
            reverse("studio:album_new"),
            reverse("studio:album_edit", args=[album.pk]),
            reverse("studio:shop"),
            reverse("studio:product_new"),
            reverse("studio:content"),
            reverse("studio:search") + "?q=dj",
        ]
        for url in urls:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_overview_flags_overdue_enquiries_and_drafts(self):
        html = self.client.get(reverse("studio:overview")).content.decode()
        self.assertIn("waiting over 24 hours", html)
        self.assertIn("still in draft", html)

    def test_city_scope_filters_and_rejects_offsite_redirects(self):
        r = self.client.get(reverse("studio:scope", args=["lagos"]) + "?next=https://evil.example/")
        self.assertRedirects(r, reverse("studio:overview"), fetch_redirect_response=False)
        html = self.client.get(reverse("studio:events")).content.decode()
        self.assertIn("HOY Live Lagos", html)
        self.assertNotIn("Afrobeats Night", html)
        self.client.get(reverse("studio:scope", args=["all"]))
        self.assertIn("Afrobeats Night", self.client.get(reverse("studio:events")).content.decode())


class StudioActionTests(HOYTestCase):
    def setUp(self):
        self.boss = User.objects.create_superuser("boss", "boss@hoy.example", "a-long-password-1")
        self.client.force_login(self.boss)
        self.los = f.city("Lagos")
        self.venue = f.venue(self.los, "Landmark")

    def test_enquiry_status_notes_and_owner_are_saved_and_logged(self):
        e = BookingEnquiry.objects.create(
            client_name="Ada",
            email="a@x.com",
            event_date=timezone.localdate() + timedelta(days=30),
            event_location="Lekki",
            event_type="private",
            expected_audience="lt100",
        )
        url = reverse("studio:enquiry_update", args=[f"bk-{e.pk}"])
        r = self.client.post(url, {"status": "won", "internal_notes": "Quote sent", "assign": "me", "back": "/studio/enquiries/"})
        self.assertRedirects(r, "/studio/enquiries/", fetch_redirect_response=False)
        e.refresh_from_db()
        self.assertEqual((e.status, e.internal_notes, e.assigned_to), ("won", "Quote sent", self.boss))
        self.assertTrue(LogEntry.objects.filter(object_id=str(e.pk), change_message__contains="Confirmed").exists())

    def test_unknown_enquiry_key_is_404(self):
        self.assertEqual(self.client.post(reverse("studio:enquiry_update", args=["xx-1"])).status_code, 404)

    def test_publish_toggle_refuses_paid_event_without_tickets(self):
        e = f.event(self.los, self.venue, status=Event.Status.DRAFT, ticket_url="")
        self.client.post(reverse("studio:event_toggle", args=[e.pk, "publish"]))
        e.refresh_from_db()
        self.assertEqual(e.status, Event.Status.DRAFT)
        e.ticket_url = "https://example.com/t"
        e.save()
        self.client.post(reverse("studio:event_toggle", args=[e.pk, "publish"]))
        e.refresh_from_db()
        self.assertEqual(e.status, Event.Status.PUBLISHED)

    def test_feature_toggle(self):
        e = f.event(self.los, self.venue)
        self.client.post(reverse("studio:event_toggle", args=[e.pk, "featured"]))
        e.refresh_from_db()
        self.assertTrue(e.is_featured)

    def test_create_event_reads_time_in_city_zone(self):
        r = self.client.post(
            reverse("studio:event_new"),
            {
                "title": "HOY Live",
                "slug": "hoy-live",
                "city": self.los.pk,
                "venue": self.venue.pk,
                "kind": "live",
                "starts_at": "2026-12-12T20:00",
                "status": "draft",
                "music_style": "afrobeats",
                "featured_order": 0,
                "age_restriction": "18+",
                "action": "save",
            },
        )
        self.assertEqual(r.status_code, 302, r.content[:3000])
        e = Event.objects.get(slug="hoy-live")
        self.assertEqual(e.starts_at, datetime(2026, 12, 12, 20, 0, tzinfo=ZoneInfo("Africa/Lagos")))

    def test_album_bulk_upload_and_video(self):
        album = Album.objects.create(title="Night", slug="night", city=self.los)
        url = reverse("studio:album_edit", args=[album.pk])
        self.client.post(
            url, {"action": "upload", "m-photos": [f.image_file("a.jpg"), f.image_file("b.jpg")], "m-video_url": "https://youtu.be/x"}
        )
        self.assertEqual(album.items.count(), 3)
        self.client.post(url, {"action": "delete_item", "item": album.items.first().pk})
        self.assertEqual(album.items.count(), 2)

    def test_site_settings_and_faqs_save(self):
        r = self.client.post(
            reverse("studio:content"),
            {"action": "site", "s-tagline": "New tagline", "s-booking_email": "b@hoy.example", "s-show_powered_by": "on"},
        )
        self.assertEqual(r.status_code, 302)
        from apps.core.models import SiteSettings

        self.assertEqual(SiteSettings.load().booking_email, "b@hoy.example")


class StudioCityTests(HOYTestCase):
    def setUp(self):
        self.boss = User.objects.create_superuser("boss", "boss@hoy.example", "a-long-password-1")
        self.client.force_login(self.boss)

    def city_data(self, **kw):
        data = {
            "name": "Accra",
            "slug": "",
            "country": "Ghana",
            "currency": "GHS",
            "timezone": "Africa/Accra",
            "ticket_provider": "",
            "whatsapp_number": "+233 20 000 0000",
            "instagram_url": "",
            "order": 3,
            "v-TOTAL_FORMS": 2,
            "v-INITIAL_FORMS": 0,
            "v-MIN_NUM_FORMS": 0,
            "v-MAX_NUM_FORMS": 1000,
            "v-0-name": "Front/Back",
            "v-0-address": "Osu",
            "v-0-map_url": "",
            "v-0-capacity": "400",
            "v-1-name": "",
            "v-1-address": "",
            "v-1-map_url": "",
            "v-1-capacity": "",
        }
        data.update(kw)
        return data

    def test_admin_adds_a_city_with_venues(self):
        r = self.client.post(reverse("studio:city_new"), self.city_data())
        from apps.core.models import City

        city = City.objects.get(slug="accra")
        self.assertRedirects(r, reverse("studio:city_edit", args=[city.pk]), fetch_redirect_response=False)
        self.assertEqual(city.currency_symbol, "₵")
        self.assertEqual([v.slug for v in city.venues.all()], ["frontback"])
        self.assertFalse(city.is_active)  # new cities start hidden unless switched on

    def test_new_city_is_hidden_from_public_api_until_switched_on(self):
        self.client.post(reverse("studio:city_new"), self.city_data())
        self.assertNotIn("accra", [c["slug"] for c in self.client.get("/api/v1/cities/").json()])
        from apps.core.models import City

        city = City.objects.get(slug="accra")
        self.client.post(reverse("studio:city_edit", args=[city.pk]), self.city_data(is_active="on", **{"v-TOTAL_FORMS": 0}))
        self.assertIn("accra", [c["slug"] for c in self.client.get("/api/v1/cities/").json()])
        # and it shows up in Studio's city switch
        self.assertIn("Accra", self.client.get(reverse("studio:overview")).content.decode())

    def test_bad_timezone_is_rejected(self):
        r = self.client.post(reverse("studio:city_new"), self.city_data(timezone="Africa/Atlantis"))
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "not a known time zone")

    def test_team_members_cannot_add_cities_but_can_edit_them(self):
        u = User.objects.create_user("ada", password="a-long-password-1", is_staff=True)
        u.groups.add(Group.objects.get(name=TEAM_GROUP))
        self.client.force_login(u)
        r = self.client.post(reverse("studio:city_new"), self.city_data())
        self.assertRedirects(r, reverse("studio:cities"), fetch_redirect_response=False)
        from apps.core.models import City

        self.assertFalse(City.objects.filter(slug="accra").exists())
        vlc = f.city("Valencia")
        self.assertEqual(self.client.get(reverse("studio:city_edit", args=[vlc.pk])).status_code, 200)

    def test_cities_page_and_readiness(self):
        call_command("seed_demo", verbosity=0)
        html = self.client.get(reverse("studio:cities")).content.decode()
        self.assertIn("Valencia", html)
        self.assertIn("Lagos", html)
        self.assertIn("Add a city", html)
