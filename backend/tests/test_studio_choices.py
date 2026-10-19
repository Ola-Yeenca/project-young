from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.db import IntegrityError
from django.test import Client
from django.urls import reverse

from apps.core.models import City, MusicStyle, Venue
from apps.events.models import Event

from . import factories as f
from .base import HOYTestCase


class StudioChoiceTests(HOYTestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser("choice-admin", "admin@example.test", "local-test-password")
        self.client.force_login(self.admin)
        self.city = f.city()
        self.other = f.city("Lagos")

    def url(self, kind):
        return reverse("studio:choice_create", args=[kind])

    def city_data(self, **changes):
        values = {"quick-name": "Test Accra", "quick-country": "Ghana", "quick-currency": "GHS", "quick-timezone": "Africa/Accra"}
        values.update(changes)
        return values

    def test_new_hidden_city_then_venue_are_available_on_event_form(self):
        response = self.client.post(self.url("city"), self.city_data())
        self.assertEqual(response.status_code, 201)
        city = City.objects.get(pk=response.json()["id"])
        self.assertFalse(city.is_active)
        venue = self.client.post(self.url("venue"), {"quick-city": city.pk, "quick-name": "Test Club", "quick-capacity": 50})
        self.assertEqual(venue.status_code, 201)
        self.assertEqual(venue.json()["city"], city.pk)
        self.assertEqual(Venue.objects.get(pk=venue.json()["id"]).city, city)
        page = self.client.get(reverse("studio:event_new"))
        self.assertContains(page, "Test Accra")
        self.assertContains(page, "Test Club")
        self.assertNotIn(city.slug, [row["slug"] for row in self.client.get("/api/v1/cities/").json()])
        self.assertFalse(Event.objects.exists())

    def test_invalid_city_and_normalized_duplicates_leave_records_intact(self):
        before = City.objects.count()
        invalid = self.client.post(self.url("city"), self.city_data(**{"quick-timezone": "Africa/Atlantis"}))
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("not a known time zone", invalid.json()["html"])
        self.assertEqual(City.objects.count(), before)
        self.client.post(self.url("city"), self.city_data())
        duplicate = self.client.post(self.url("city"), self.city_data(**{"quick-name": " test   accra "}))
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(City.objects.count(), before + 1)

    def test_venue_duplicate_is_city_scoped_and_bad_city_is_rejected(self):
        data = {"quick-city": self.city.pk, "quick-name": "Test Room"}
        self.assertEqual(self.client.post(self.url("venue"), data).status_code, 201)
        self.assertEqual(self.client.post(self.url("venue"), {**data, "quick-name": " test  room "}).status_code, 400)
        self.assertEqual(self.client.post(self.url("venue"), {**data, "quick-city": self.other.pk}).status_code, 201)
        self.assertEqual(self.client.post(self.url("venue"), {**data, "quick-city": 999999}).status_code, 400)
        self.assertEqual(Venue.objects.count(), 2)

    def test_style_reused_on_event_talent_and_public_api(self):
        created = self.client.post(self.url("music-style"), {"quick-name": "Afrohouse"})
        self.assertEqual(created.status_code, 201)
        style = MusicStyle.objects.get(pk=created.json()["id"])
        duplicate = self.client.post(self.url("music-style"), {"quick-name": " AFROHOUSE "})
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(MusicStyle.objects.filter(normalized_name="afrohouse").count(), 1)
        event = f.event(self.city, music_style=style.slug)
        data = self.client.get(f"/api/v1/events/{event.slug}/").json()
        self.assertEqual(data["music_style"], style.slug)
        self.assertEqual(data["music_style_label"], "Afrohouse")
        talent = f.talent(self.city, genre=style.name)
        self.assertEqual(self.client.get(f"/api/v1/talent/{talent.slug}/").json()["genre"], style.name)
        self.assertContains(self.client.get(reverse("studio:talent_edit", args=[talent.pk])), 'value="Afrohouse"')
        event.refresh_from_db()
        talent.refresh_from_db()
        self.assertEqual((event.music_style, talent.genre), (style.slug, style.name))

    def test_public_builtin_style_label_survives_catalog_deletion(self):
        MusicStyle.objects.filter(slug="afrobeats").delete()
        event = f.event(self.city, music_style="afrobeats")
        data = self.client.get(f"/api/v1/events/{event.slug}/").json()
        self.assertEqual(data["music_style"], "afrobeats")
        self.assertEqual(data["music_style_label"], "Afrobeats")

    def test_staff_permissions_are_checked_on_get_and_post(self):
        user = get_user_model().objects.create_user("choice-staff", password="local-test-password", is_staff=True)
        self.client.force_login(user)
        for kind in ("city", "venue", "music-style"):
            self.assertEqual(self.client.get(self.url(kind)).status_code, 403)
            self.assertEqual(self.client.post(self.url(kind), {}).status_code, 403)
        user.user_permissions.add(Permission.objects.get(codename="add_city", content_type__app_label="core"))
        self.assertEqual(self.client.post(self.url("city"), self.city_data()).status_code, 201)
        self.assertEqual(self.client.get(self.url("venue")).status_code, 403)

    def test_csrf_is_required_and_anonymous_users_cannot_create(self):
        anonymous = Client()
        self.assertEqual(anonymous.post(self.url("city"), self.city_data()).status_code, 302)
        protected = Client(enforce_csrf_checks=True)
        protected.force_login(self.admin)
        self.assertEqual(protected.post(self.url("city"), self.city_data()).status_code, 403)
        protected.get(self.url("city"))
        token = protected.cookies["csrftoken"].value
        self.assertEqual(protected.post(self.url("city"), self.city_data(), HTTP_X_CSRFTOKEN=token).status_code, 201)

    def test_concurrent_duplicate_returns_a_useful_error(self):
        with patch("apps.core.models.MusicStyle.save", side_effect=IntegrityError):
            response = self.client.post(self.url("music-style"), {"quick-name": "Test Race Style"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.json()["html"])
        self.assertFalse(MusicStyle.objects.filter(name="Test Race Style").exists())

    def test_event_cannot_save_a_venue_in_another_city(self):
        venue = f.venue(self.other)
        data = {
            "title": "Test mismatch",
            "slug": "test-mismatch",
            "city": self.city.pk,
            "venue": venue.pk,
            "kind": "club",
            "starts_at": "2027-02-20T20:00",
            "status": "draft",
            "music_style": "afrobeats",
            "featured_order": 0,
        }
        response = self.client.post(reverse("studio:event_new"), data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "not")
        self.assertFalse(Event.objects.filter(slug="test-mismatch").exists())
