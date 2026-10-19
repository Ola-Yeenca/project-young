from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.community.models import Member
from apps.core.roles import TEAM_GROUP, sync_team_group

from . import factories as f
from .base import HOYTestCase

User = get_user_model()
URL = "/api/v1/community/"


def join(api, **kw):
    cache.clear()
    body = {
        "name": "Ada Obi",
        "email": "ada@x.example",
        "city": "lagos",
        "channel": "email",
        "interests": ["events"],
        "consent": True,
        **kw,
    }
    return api.post(URL, body, format="json")


class CommunityJoinTests(HOYTestCase):
    def setUp(self):
        self.api = APIClient()
        self.lagos = f.city("Lagos")

    def test_join_stores_member_and_answers_without_personal_data(self):
        r = join(
            self.api,
            phone="+234 803 000 0000",
            channel="both",
            instagram="https://www.instagram.com/@ada.obi/",
            interests=["events", "merch"],
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json(), {"status": "joined"})
        m = Member.objects.get()
        self.assertEqual((m.city, m.instagram, m.channel), (self.lagos, "ada.obi", "both"))
        self.assertEqual(m.interests, ["Events", "Merch drops"])
        self.assertIsNotNone(m.consent_at)

    def test_consent_is_required(self):
        r = join(self.api, consent=False)
        self.assertEqual(r.status_code, 400)
        self.assertIn("consent", r.json())
        self.assertFalse(Member.objects.exists())

    def test_whatsapp_needs_a_phone_number(self):
        r = join(self.api, channel="whatsapp")
        self.assertEqual(r.status_code, 400)
        self.assertIn("phone", r.json())

    def test_rejoining_updates_the_member_and_resubscribes(self):
        join(self.api)
        Member.objects.update(unsubscribed_at="2026-01-01T00:00:00Z")
        r = join(self.api, email="ADA@x.example", interests=["talent"])
        self.assertEqual(r.status_code, 201)
        m = Member.objects.get()
        self.assertIsNone(m.unsubscribed_at)
        self.assertEqual(m.interests, ["Talent opportunities"])

    def test_bad_instagram_and_honeypot_are_rejected(self):
        self.assertIn("instagram", join(self.api, instagram="not a handle!").json())
        self.assertEqual(join(self.api, website="spam.example").status_code, 400)
        self.assertFalse(Member.objects.exists())


class CommunityStudioTests(HOYTestCase):
    def setUp(self):
        sync_team_group()
        self.user = User.objects.create_user("ada", password="a-long-password-1", is_staff=True)
        self.user.groups.add(Group.objects.get(name=TEAM_GROUP))
        self.client.force_login(self.user)
        f.city("Lagos")
        join(APIClient())
        self.member = Member.objects.get()

    def test_team_sees_and_exports_members(self):
        r = self.client.get(reverse("studio:community"))
        self.assertContains(r, "ada@x.example")
        csv = self.client.get(reverse("studio:community") + "?format=csv")
        self.assertEqual(csv["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("ada@x.example", csv.content.decode())

    def test_unsubscribe_drops_member_from_list_and_export(self):
        self.client.post(reverse("studio:member_update", args=[self.member.pk]), {"action": "unsubscribe"})
        self.assertNotIn("ada@x.example", self.client.get(reverse("studio:community") + "?format=csv").content.decode())
        self.assertContains(self.client.get(reverse("studio:community") + "?show=left"), "ada@x.example")

    def test_delete_erases_the_member(self):
        self.client.post(reverse("studio:member_update", args=[self.member.pk]), {"action": "delete"})
        self.assertFalse(Member.objects.exists())
