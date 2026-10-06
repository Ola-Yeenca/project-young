from datetime import datetime
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.urls import reverse

from apps.core.roles import TEAM_GROUP
from apps.events.admin import EventAdminForm
from apps.events.models import Event
from apps.gallery.models import Album

from . import factories as f
from .base import HOYTestCase


class AdminSmokeTests(HOYTestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser("boss", "boss@hoy.example", "a-long-password-1")
        self.client.force_login(self.admin)
        call_command("seed_demo", verbosity=0)

    def test_every_changelist_and_add_page_loads(self):
        for model in [
            "core/city",
            "core/venue",
            "core/faq",
            "core/sitesettings",
            "events/event",
            "talent/talent",
            "gallery/album",
            "shop/product",
            "enquiries/bookingenquiry",
            "enquiries/contactenquiry",
        ]:
            app, name = model.split("/")
            for view in ("changelist", "add"):
                if model == "core/sitesettings" and view == "add":
                    continue
                url = reverse(f"admin:{app}_{name}_{view}")
                self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_event_change_page_loads(self):
        e = Event.objects.first()
        self.assertEqual(self.client.get(reverse("admin:events_event_change", args=[e.pk])).status_code, 200)

    def test_bulk_photo_upload_adds_items(self):
        album = Album.objects.first()
        before = album.items.count()
        url = reverse("admin:gallery_album_change", args=[album.pk])
        data = {
            "title": album.title,
            "slug": album.slug,
            "city": album.city_id,
            "date": "",
            "is_published": "on",
            "order": 0,
            "upload": [f.image_file("a.jpg"), f.image_file("b.jpg")],
            "items-TOTAL_FORMS": 0,
            "items-INITIAL_FORMS": 0,
            "items-MIN_NUM_FORMS": 0,
            "items-MAX_NUM_FORMS": 1000,
        }
        r = self.client.post(url, data)
        self.assertEqual(r.status_code, 302, r.content[:2000])
        self.assertEqual(album.items.count(), before + 2)


class TeamGroupTests(HOYTestCase):
    def test_team_group_can_manage_content_not_users(self):
        group = Group.objects.get(name=TEAM_GROUP)
        codes = set(group.permissions.values_list("codename", flat=True))
        self.assertIn("change_event", codes)
        self.assertIn("change_bookingenquiry", codes)
        self.assertNotIn("change_user", codes)
        self.assertNotIn("delete_city", codes)


class EventTimezoneFormTests(HOYTestCase):
    """20:00 typed for a Lagos event must mean 20:00 in Lagos, not in Madrid."""

    def test_wall_time_is_read_in_the_event_city(self):
        los = f.city("Lagos")
        v = f.venue(los, "Landmark")
        form = EventAdminForm(
            data={
                "title": "HOY Live",
                "slug": "hoy-live",
                "city": los.pk,
                "venue": v.pk,
                "kind": "live",
                "starts_at": "2026-12-12 20:00:00",
                "music_style": "afrobeats",
                "status": "draft",
                "featured_order": 0,
                "age_restriction": "18+",
            }
        )
        self.assertTrue(form.is_valid(), form.errors)
        event = form.save()
        self.assertEqual(event.starts_at, datetime(2026, 12, 12, 20, 0, tzinfo=ZoneInfo("Africa/Lagos")))

        edit = EventAdminForm(instance=event)
        self.assertEqual(edit.initial["starts_at"], datetime(2026, 12, 12, 20, 0))


class CommandTests(HOYTestCase):
    def test_seed_refuses_twice_without_force(self):
        from django.core.management.base import CommandError

        call_command("seed_demo", verbosity=0)
        with self.assertRaises(CommandError):
            call_command("seed_demo", verbosity=0)

    def test_purge_old_enquiries(self):
        from datetime import timedelta

        from django.utils import timezone

        from apps.enquiries.models import ContactEnquiry

        old = ContactEnquiry.objects.create(name="Old", email="o@x.com", message="m")
        ContactEnquiry.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=800))
        ContactEnquiry.objects.create(name="New", email="n@x.com", message="m")
        call_command("purge_old_enquiries", months=24, verbosity=0, stdout=open("/dev/null", "w"))
        self.assertEqual(list(ContactEnquiry.objects.values_list("name", flat=True)), ["New"])
