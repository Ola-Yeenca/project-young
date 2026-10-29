import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.roles import TEAM_GROUP, sync_team_group
from apps.radio.models import Track

from . import factories as f
from .base import HOYTestCase

User = get_user_model()
MEDIA = tempfile.mkdtemp()


def mp3(name="tune.mp3"):
    return SimpleUploadedFile(name, b"ID3" + b"\0" * 64, content_type="audio/mpeg")


@override_settings(MEDIA_ROOT=MEDIA)
class RadioTests(HOYTestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.lagos = f.city("Lagos")
        sync_team_group()
        self.user = User.objects.create_user("ada", password="a-long-password-1", is_staff=True)
        self.user.groups.add(Group.objects.get(name=TEAM_GROUP))
        self.client.force_login(self.user)

    def upload(self, **kw):
        data = {
            "t-title": "Sunset",
            "t-artist": "DJ Tolu",
            "t-genre": "amapiano",
            "t-city": self.lagos.pk,
            "t-file": mp3(),
            "t-rights": "Own track, OK'd 12 Oct",
            "t-is_published": "on",
            **kw,
        }
        return self.client.post(reverse("studio:radio"), data)

    def test_upload_goes_on_air_and_shows_in_the_api(self):
        self.assertRedirects(self.upload(), reverse("studio:radio"))
        Track.objects.create(title="Draft", artist="X", genre="techno", file=mp3("d.mp3"), rights="ok", is_published=False)
        data = APIClient().get("/api/v1/radio/").json()
        self.assertEqual([(t["title"], t["artist"], t["genre"], t["city"]) for t in data], [("Sunset", "DJ Tolu", "amapiano", "lagos")])
        self.assertTrue(data[0]["url"].endswith(".mp3"))

    def test_permission_note_and_audio_file_are_required(self):
        self.upload(**{"t-rights": ""})
        self.upload(**{"t-file": SimpleUploadedFile("cover.jpg", b"x", content_type="image/jpeg")})
        self.assertFalse(Track.objects.exists())

    def test_toggle_and_delete(self):
        self.upload()
        t = Track.objects.get()
        self.client.post(reverse("studio:track_update", args=[t.pk]), {"action": "toggle"})
        t.refresh_from_db()
        self.assertFalse(t.is_published)
        self.client.post(reverse("studio:track_update", args=[t.pk]), {"action": "delete"})
        self.assertFalse(Track.objects.exists())

    def test_studio_page_renders(self):
        self.upload()
        self.assertContains(self.client.get(reverse("studio:radio")), "DJ Tolu")
