import shutil
import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from apps.core.roles import TEAM_GROUP, sync_team_group
from apps.gallery.models import Album, AlbumItem, PhotoHit

from . import factories as f
from .base import HOYTestCase

User = get_user_model()
MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA)
class PhotoStatsTests(HOYTestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.lagos = f.city("Lagos")
        self.event = f.event(self.lagos, title="Rooftop Sessions")
        self.album = Album.objects.create(title="Rooftop night", slug="rooftop-night", city=self.lagos, event=self.event)
        self.photo = AlbumItem.objects.create(album=self.album, image=f.image_file())
        self.api = APIClient()

    def view(self, client=None, **body):
        return (client or self.api).post(reverse("photo-view", args=[self.photo.pk]), body, format="json")

    def test_view_counts_once_per_visitor_per_day(self):
        self.assertEqual(self.view().json(), {"views": 1, "downloads": 0})
        self.assertEqual(self.view().json()["views"], 1)
        other = APIClient(HTTP_USER_AGENT="Another browser")
        self.assertEqual(self.view(other).json()["views"], 2)
        hit = PhotoHit.objects.first()
        self.assertEqual(len(hit.visitor), 16)
        self.assertEqual(hit.device, "")

    def test_device_key_is_kept_only_when_well_formed_and_never_raw(self):
        raw = "ab" * 32
        self.view(device=raw)
        self.view(APIClient(HTTP_USER_AGENT="x"), device="not-a-hash")
        devices = list(PhotoHit.objects.values_list("device", flat=True))
        self.assertIn("", devices)
        kept = [d for d in devices if d]
        self.assertEqual(len(kept), 1)
        self.assertNotIn(kept[0], raw)

    def test_download_is_a_credited_jpeg_and_counted(self):
        res = self.api.get(reverse("photo-download", args=[self.photo.pk]))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "image/jpeg")
        self.assertIn("attachment", res["Content-Disposition"])
        exif = Image.open(BytesIO(res.content)).getexif()
        self.assertEqual(exif[315], "House of Young")
        self.assertIn("Rooftop Sessions", exif[270])
        self.photo.refresh_from_db()
        self.assertEqual(self.photo.downloads, 1)

    def test_hidden_photos_and_videos_are_not_served(self):
        self.album.is_published = False
        self.album.save()
        self.assertEqual(self.view().status_code, 404)
        self.album.is_published = True
        self.album.save()
        video = AlbumItem.objects.create(album=self.album, kind="video", video_url="https://youtu.be/x")
        self.assertEqual(self.api.get(reverse("photo-download", args=[video.pk])).status_code, 404)

    def test_api_exposes_counts_and_event_title(self):
        self.view()
        data = self.api.get("/api/v1/gallery/rooftop-night/").json()
        self.assertEqual(data["event_title"], "Rooftop Sessions")
        self.assertEqual(data["items"][0]["views"], 1)

    def test_studio_ranks_top_photos(self):
        sync_team_group()
        user = User.objects.create_user("ada", password="a-long-password-1", is_staff=True)
        user.groups.add(Group.objects.get(name=TEAM_GROUP))
        self.client.force_login(user)
        self.view()
        page = self.client.get(reverse("studio:gallery"))
        self.assertContains(page, "Top photos")
        self.assertContains(page, "1 view,")
        self.assertContains(self.client.get(reverse("studio:gallery") + "?rank=downloads"), "No downloads yet")
