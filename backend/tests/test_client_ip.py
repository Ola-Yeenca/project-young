from unittest import mock

from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.core.net import client_ip
from apps.enquiries.models import ContactEnquiry
from apps.gallery.models import Album, AlbumItem

from . import factories as f
from .base import HOYTestCase


class ClientIPTests(SimpleTestCase):
    def ip(self, forwarded=None, **meta):
        if forwarded is not None:
            meta["HTTP_X_FORWARDED_FOR"] = forwarded
        return client_ip(RequestFactory().get("/", REMOTE_ADDR="10.0.0.2", **meta))

    def test_only_the_hop_our_proxy_added_is_trusted(self):
        self.assertEqual(self.ip("81.2.3.4"), "81.2.3.4")
        self.assertEqual(self.ip("9.9.9.9, 1.1.1.1, 81.2.3.4"), "81.2.3.4")
        self.assertEqual(self.ip("81.2.3.4", HTTP_X_REAL_IP="9.9.9.9"), "81.2.3.4")
        self.assertEqual(self.ip("9.9.9.9, 2001:db8::1"), "2001:db8::1")

    @override_settings(HOY_TRUSTED_PROXIES=2)
    def test_each_extra_proxy_moves_one_hop_left(self):
        self.assertEqual(self.ip("9.9.9.9, 81.2.3.4, 10.0.0.1"), "81.2.3.4")

    @override_settings(HOY_TRUSTED_PROXIES=0)
    def test_without_proxies_the_header_is_ignored(self):
        self.assertEqual(self.ip("9.9.9.9"), "10.0.0.2")

    def test_a_missing_or_garbled_header_falls_back_to_the_connection(self):
        self.assertEqual(self.ip(), "10.0.0.2")
        self.assertEqual(self.ip("9.9.9.9, not-an-address"), "10.0.0.2")


class SpoofedForwardingTests(HOYTestCase):
    """A visitor can put anything in front of Railway's hop; it must not make them someone new."""

    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def contact(self, forwarded):
        body = {"category": "general", "name": "Bola", "email": "bola@example.com", "message": "Hi", "privacy_accepted": True}
        return self.api.post("/api/v1/enquiries/contact/", body, format="json", HTTP_X_FORWARDED_FOR=forwarded)

    def test_rate_limit_keys_on_the_trusted_hop(self):
        with mock.patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"enquiries": "2/hour"}):
            codes = [self.contact(f"9.9.9.{n}, 81.2.3.4").status_code for n in range(3)]
            self.assertEqual(codes, [201, 201, 429])
            self.assertEqual(self.contact("81.2.3.5").status_code, 201)
        self.assertEqual(ContactEnquiry.objects.count(), 3)

    def test_gallery_counts_key_on_the_trusted_hop(self):
        lagos = f.city("Lagos")
        album = Album.objects.create(title="Rooftop night", slug="rooftop-night", city=lagos)
        photo = AlbumItem.objects.create(album=album, image=f.image_file())
        url = reverse("photo-view", args=[photo.pk])
        for forwarded in ("9.9.9.1, 81.2.3.4", "9.9.9.2, 81.2.3.4"):
            self.api.post(url, {}, format="json", HTTP_X_FORWARDED_FOR=forwarded)
        photo.refresh_from_db()
        self.assertEqual(photo.views, 1)
        self.api.post(url, {}, format="json", HTTP_X_FORWARDED_FOR="81.2.3.5")
        photo.refresh_from_db()
        self.assertEqual(photo.views, 2)
