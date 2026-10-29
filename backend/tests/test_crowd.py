from datetime import timedelta
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from api.views import EventTaste
from apps.core.models import MusicStyle
from apps.core.roles import DJ_GROUP, TEAM_GROUP, sync_dj_group, sync_team_group
from apps.crowd.models import TasteAnswer
from apps.enquiries.models import BookingEnquiry
from apps.events.models import Event

from . import factories as f
from .base import HOYTestCase

User = get_user_model()
TOKEN = "a" * 32


class TasteApiTests(HOYTestCase):
    def setUp(self):
        cache.clear()
        self.city = f.city("Lagos")
        self.event = f.event(self.city, title="Rooftop Sessions", days=1)
        self.api = APIClient()

    def url(self, event=None):
        return reverse("event-taste", args=[(event or self.event).slug])

    def answer(self, event=None, **body):
        data = {"token": TOKEN, "source": "ticket", "genres": ["amapiano"], "artist": "", "song": "", **body}
        return self.api.post(self.url(event), data, format="json")

    def test_answer_is_saved_then_updated_for_the_same_token(self):
        r = self.answer(genres=["amapiano", "afrobeats"], artist="Asake")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["total"], 1)
        r = self.answer(genres=["highlife"], song="Calm Down")
        self.assertEqual(r.status_code, 200)
        a = TasteAnswer.objects.get()
        self.assertEqual((a.genres, a.artist, a.song, a.city), (["highlife"], "", "Calm Down", self.city))

    def test_guests_sharing_one_address_and_browser_are_counted_separately(self):
        for n in range(3):
            self.assertEqual(self.answer(token=f"guest-{n}-" + "x" * 16).status_code, 201)
        self.assertEqual(TasteAnswer.objects.count(), 3)
        self.assertEqual(self.answer(token="guest-0-" + "x" * 16, source="qr").status_code, 201)
        self.assertEqual(TasteAnswer.objects.count(), 4)

    def test_visitor_code_is_a_keyed_hash_of_the_token(self):
        self.answer()
        visitor = TasteAnswer.objects.get().visitor
        self.assertEqual(len(visitor), 16)
        self.assertNotIn(visitor, TOKEN)

    def test_input_checks(self):
        cases = [
            ({"genres": ["amapiano", "afrobeats", "highlife", "mixed"]}, "genres"),
            ({"genres": ["polka"]}, "genres"),
            ({"artist": "x" * 81}, "artist"),
            ({"song": "x" * 121}, "song"),
            ({"token": "short"}, "token"),
            ({"source": "email"}, "source"),
            ({"genres": [], "artist": " ", "song": ""}, "non_field_errors"),
            ({"website": "http://spam.example"}, "non_field_errors"),
        ]
        for body, field in cases:
            r = self.answer(**body)
            self.assertEqual(r.status_code, 400, body)
            self.assertIn(field, r.json(), body)
        self.assertFalse(TasteAnswer.objects.exists())

    def test_text_is_trimmed_and_genres_deduplicated(self):
        self.answer(genres=["amapiano", "amapiano"], artist="  Burna   Boy ", song=" Last  Last ")
        a = TasteAnswer.objects.get()
        self.assertEqual((a.genres, a.artist, a.song), (["amapiano"], "Burna Boy", "Last Last"))

    def test_only_open_published_events_take_answers(self):
        now = timezone.now()
        running = f.event(self.city, title="Running", starts_at=now - timedelta(hours=11))
        over = f.event(self.city, title="Over", starts_at=now - timedelta(hours=13))
        festival = f.event(self.city, title="Festival", starts_at=now - timedelta(hours=20), ends_at=now + timedelta(hours=1))
        draft = f.event(self.city, title="Draft", status=Event.Status.DRAFT)
        cancelled = f.event(self.city, title="Cancelled", status=Event.Status.CANCELLED)
        self.assertEqual(self.answer(running).status_code, 201)
        self.assertEqual(self.answer(festival).status_code, 201)
        self.assertEqual(self.answer(over).status_code, 400)
        self.assertEqual(self.answer(cancelled).status_code, 400)
        self.assertEqual(self.answer(draft).status_code, 404)
        self.assertEqual(self.api.get(self.url(draft)).status_code, 404)
        self.assertFalse(self.api.get(self.url(over)).json()["open"])
        self.city.is_active = False
        self.city.save()
        self.assertEqual(self.answer().status_code, 404)

    def test_public_summary_shows_shares_but_never_free_text(self):
        self.answer(genres=["amapiano", "afrobeats"], artist="Secret Artist", song="Secret Song")
        self.answer(token="b" * 32, genres=["amapiano"])
        self.answer(token="c" * 32, genres=[], song="Another Secret")
        r = self.api.get(self.url())
        data = r.json()
        self.assertEqual(set(data), {"open", "closes_at", "options", "total", "genres"})
        self.assertEqual(data["total"], 3)
        self.assertEqual(data["genres"][0], {"slug": "amapiano", "name": "Amapiano", "percent": 100})
        self.assertEqual(data["genres"][1]["percent"], 50)
        self.assertIn({"slug": "highlife", "name": "Highlife"}, data["options"])
        self.assertNotIn(b"Secret", r.content)

    def test_event_style_comes_first_and_empty_catalog_falls_back_to_radio_genres(self):
        self.event.music_style = "highlife"
        self.event.save()
        self.assertEqual(self.api.get(self.url()).json()["options"][0]["slug"], "highlife")
        MusicStyle.objects.all().delete()
        slugs = [o["slug"] for o in self.api.get(self.url()).json()["options"]]
        self.assertEqual(slugs[0], "highlife")
        self.assertIn("techno", slugs)
        self.assertEqual(self.answer(genres=["techno", "highlife"]).status_code, 201)

    def test_answers_are_rate_limited_under_their_own_generous_scope(self):
        self.assertEqual(EventTaste.throttle_scope, "crowd")
        self.assertIn("crowd", settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"])
        self.assertEqual(settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["crowd"], "1000/hour")
        with mock.patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"crowd": "2/min"}):
            self.assertEqual(self.answer(token="1" * 20).status_code, 201)
            self.assertEqual(self.answer(token="2" * 20).status_code, 201)
            self.assertEqual(self.answer(token="3" * 20).status_code, 429)
            for _ in range(3):
                self.assertEqual(self.api.get(self.url()).status_code, 200)


class CrowdStudioTests(HOYTestCase):
    @classmethod
    def setUpTestData(cls):
        sync_team_group()
        sync_dj_group()
        cls.city = f.city("Valencia")
        cls.event = f.event(cls.city, title="Afro Night", days=0)
        cls.dj = User.objects.create_user("dj-tolu", password="a-long-password-1", is_staff=True, first_name="DJ Tolu")
        cls.dj.groups.add(Group.objects.get(name=DJ_GROUP))
        cls.team = User.objects.create_user("ada", password="a-long-password-1", is_staff=True)
        cls.team.groups.add(Group.objects.get(name=TEAM_GROUP))

    def add(self, visitor, **fields):
        defaults = {"source": "qr", "genres": ["amapiano"], "artist": "", "song": ""}
        return TasteAnswer.objects.create(event=self.event, city=self.city, visitor=visitor, **{**defaults, **fields})

    def test_groups_get_the_right_crowd_permissions(self):
        team = set(Group.objects.get(name=TEAM_GROUP).permissions.values_list("codename", flat=True))
        self.assertTrue({"view_tasteanswer", "change_tasteanswer", "manage_djs"} <= team)
        dj = set(Group.objects.get(name=DJ_GROUP).permissions.values_list("codename", flat=True))
        self.assertEqual(dj, {"view_tasteanswer"})

    def test_dj_lands_on_crowd_and_can_open_nothing_else(self):
        self.client.force_login(self.dj)
        self.assertRedirects(self.client.get(reverse("studio:overview")), reverse("studio:crowd"))
        page = self.client.get(reverse("studio:crowd"))
        self.assertContains(page, "Afro Night")
        self.assertNotContains(page, reverse("studio:enquiries"))
        self.assertNotContains(page, reverse("studio:community"))
        self.assertNotContains(page, "Advanced admin")
        self.assertNotContains(page, "DJ logins")
        self.assertEqual(self.client.get(reverse("studio:crowd_event", args=[self.event.pk])).status_code, 200)
        self.assertEqual(self.client.get(reverse("studio:crowd_qr", args=[self.event.pk])).status_code, 200)
        for name in ("enquiries", "community", "events", "talent", "gallery", "radio", "shop", "content", "cities"):
            self.assertEqual(self.client.get(reverse(f"studio:{name}")).status_code, 403, name)
        self.assertEqual(self.client.get(reverse("admin:enquiries_bookingenquiry_changelist")).status_code, 403)
        self.assertEqual(self.client.get(reverse("admin:crowd_tasteanswer_changelist")).status_code, 403)
        self.assertNotContains(self.client.get(reverse("admin:index")), "Booking enquir")

    def test_dj_search_finds_nothing_private(self):
        enquiry = BookingEnquiry.objects.create(
            client_name="Adaeze",
            email="a@x.com",
            event_date=timezone.localdate() + timedelta(days=30),
            event_location="Lekki",
            event_type="private",
            expected_audience="lt100",
        )
        self.client.force_login(self.dj)
        self.assertNotContains(self.client.get(reverse("studio:search"), {"q": "Adaeze"}), enquiry.reference)
        self.client.force_login(self.team)
        self.assertContains(self.client.get(reverse("studio:search"), {"q": "Adaeze"}), enquiry.reference)

    def test_dj_cannot_manage_logins_or_hide_requests(self):
        self.client.force_login(self.dj)
        r = self.client.post(reverse("studio:dj_create"), {"name": "Sneaky", "username": "sneaky"})
        self.assertEqual(r.status_code, 403)
        self.assertFalse(User.objects.filter(username="sneaky").exists())
        self.assertEqual(self.client.post(reverse("studio:dj_update", args=[self.dj.pk]), {"action": "toggle"}).status_code, 403)
        self.add("v1", song="Water")
        self.assertEqual(self.client.post(reverse("studio:crowd_hide", args=[self.event.pk]), {"song": "water"}).status_code, 403)
        self.assertFalse(TasteAnswer.objects.get().song_hidden)

    def test_team_creates_a_dj_login_that_works_once_shown(self):
        self.client.force_login(self.team)
        r = self.client.post(reverse("studio:dj_create"), {"name": "DJ Kemi", "username": "kemi"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Cache-Control"], "no-store")
        password = r.context["new_login"]["password"]
        self.assertContains(r, password)
        self.assertGreaterEqual(len(password), 16)
        kemi = User.objects.get(username="kemi")
        self.assertTrue(kemi.is_staff)
        self.assertFalse(kemi.is_superuser)
        self.assertEqual(list(kemi.groups.values_list("name", flat=True)), [DJ_GROUP])
        self.assertNotContains(self.client.get(reverse("studio:crowd")), password)
        self.assertEqual(self.client.post(reverse("studio:dj_create"), {"name": "Again", "username": "KEMI"}).status_code, 400)
        self.client.logout()
        self.assertTrue(self.client.login(username="kemi", password=password))

    def test_team_switches_dj_logins_off_and_on_but_not_team_members(self):
        self.client.force_login(self.team)
        url = reverse("studio:dj_update", args=[self.dj.pk])
        self.client.post(url, {"action": "toggle"})
        self.dj.refresh_from_db()
        self.assertFalse(self.dj.is_active)
        self.client.post(url, {"action": "toggle"})
        self.dj.refresh_from_db()
        self.assertTrue(self.dj.is_active)
        r = self.client.post(url, {"action": "password"})
        self.assertTrue(self.client.login(username="dj-tolu", password=r.context["new_login"]["password"]))
        self.client.force_login(self.team)
        self.assertEqual(self.client.post(reverse("studio:dj_update", args=[self.team.pk]), {"action": "toggle"}).status_code, 404)

    def test_board_groups_requests_and_artists_and_hides_unsuitable_songs(self):
        self.add("v1", artist="burna boy", song="Last Last")
        self.add("v2", artist="Burna  Boy", song="last last")
        self.add("v3", artist="BURNA BOY", song="Rude song", genres=["afrobeats", "amapiano"])
        self.add("v4", song="Tems – Free Mind")
        self.add("v5", song="tems-free mind")
        self.client.force_login(self.team)
        r = self.client.get(reverse("studio:crowd_event", args=[self.event.pk]))
        self.assertEqual(r.context["total"], 5)
        self.assertEqual([(a["value"]) for a in r.context["artists"]], [3])
        self.assertEqual({s["key"]: s["count"] for s in r.context["songs"]}, {"tems - free mind": 2, "rude song": 1, "last last": 2})
        self.assertEqual(r.context["genres"][0]["slug"], "amapiano")
        self.client.post(reverse("studio:crowd_hide", args=[self.event.pk]), {"song": "rude song"})
        r = self.client.get(reverse("studio:crowd_event", args=[self.event.pk]) + "?partial=1")
        self.assertNotContains(r, "Rude song")
        self.assertContains(r, "1 hidden")
        self.assertContains(r, "×2")

    def test_a_changed_request_comes_back_after_hiding(self):
        from apps.crowd.taste import save_answer

        save_answer(self.event, "v1", "qr", genres=[], artist="", song="Rude song")
        TasteAnswer.objects.update(song_hidden=True)
        save_answer(self.event, "v1", "qr", genres=[], artist="", song="Rude song")
        self.assertTrue(TasteAnswer.objects.get().song_hidden)
        save_answer(self.event, "v1", "qr", genres=[], artist="", song="Water")
        self.assertFalse(TasteAnswer.objects.get().song_hidden)

    def test_overview_ranks_genres_and_artists_for_the_city(self):
        self.add("v1", artist="Tems", genres=["afrobeats"])
        self.add("v2", artist="tems", genres=["afrobeats", "amapiano"])
        self.client.force_login(self.dj)
        r = self.client.get(reverse("studio:crowd"))
        self.assertEqual(r.context["total"], 2)
        self.assertEqual(r.context["genres"][0]["slug"], "afrobeats")
        self.assertEqual(r.context["artists"][0]["value"], 2)
        self.assertEqual(r.context["upcoming"][0]["e"].answers, 2)

    @override_settings(HOY_SITE_URL="https://fromthehouseofyoung.com")
    def test_qr_code_points_at_the_tonight_page(self):
        self.client.force_login(self.dj)
        r = self.client.get(reverse("studio:crowd_qr", args=[self.event.pk]))
        self.assertContains(r, "<svg")
        self.assertContains(r, f"https://fromthehouseofyoung.com/tonight/{self.event.slug}")
        board = self.client.get(reverse("studio:crowd_event", args=[self.event.pk]))
        self.assertContains(board, 'class="qr"')
