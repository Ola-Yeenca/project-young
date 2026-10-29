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

# What Railway's edge writes: the visitor, then the edge node that took the request.
EDGE = "203.0.113.7"


class ClientIPTests(SimpleTestCase):
    def ip(self, forwarded=None, **meta):
        if forwarded is not None:
            meta["HTTP_X_FORWARDED_FOR"] = forwarded
        return client_ip(RequestFactory().get("/", REMOTE_ADDR="10.0.0.2", **meta))

    def test_the_visitor_is_the_entry_before_the_edge(self):
        self.assertEqual(self.ip(f"81.2.3.4, {EDGE}"), "81.2.3.4")
        self.assertEqual(self.ip(f"2001:db8::1, {EDGE}"), "2001:db8::1")
        self.assertEqual(self.ip(f"81.2.3.4, {EDGE}", HTTP_X_REAL_IP="9.9.9.9"), "81.2.3.4")

    def test_entries_a_visitor_puts_in_front_are_ignored(self):
        self.assertEqual(self.ip(f"9.9.9.9, 1.1.1.1, 81.2.3.4, {EDGE}"), "81.2.3.4")

    @override_settings(HOY_TRUSTED_PROXIES=1)
    def test_one_proxy_trusts_only_the_last_entry(self):
        self.assertEqual(self.ip("9.9.9.9, 81.2.3.4"), "81.2.3.4")

    @override_settings(HOY_TRUSTED_PROXIES=0)
    def test_without_proxies_the_header_is_ignored(self):
        self.assertEqual(self.ip(f"9.9.9.9, {EDGE}"), "10.0.0.2")

    def test_a_missing_or_garbled_header_falls_back_to_the_connection(self):
        self.assertEqual(self.ip(), "10.0.0.2")
        self.assertEqual(self.ip(f"not-an-address, {EDGE}"), "10.0.0.2")


class SpoofedForwardingTests(HOYTestCase):
    """A visitor can put anything in front of what Railway wrote; it must not make them someone new."""

    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    def contact(self, forwarded):
        body = {"category": "general", "name": "Bola", "email": "bola@example.com", "message": "Hi", "privacy_accepted": True}
        return self.api.post("/api/v1/enquiries/contact/", body, format="json", HTTP_X_FORWARDED_FOR=forwarded)

    def test_rate_limit_keys_on_the_visitor(self):
        with mock.patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"enquiries": "2/hour"}):
            codes = [self.contact(f"9.9.9.{n}, 81.2.3.4, {EDGE}").status_code for n in range(3)]
            self.assertEqual(codes, [201, 201, 429])
            self.assertEqual(self.contact(f"81.2.3.5, {EDGE}").status_code, 201)
        self.assertEqual(ContactEnquiry.objects.count(), 3)

    def test_gallery_counts_key_on_the_visitor(self):
        lagos = f.city("Lagos")
        album = Album.objects.create(title="Rooftop night", slug="rooftop-night", city=lagos)
        photo = AlbumItem.objects.create(album=album, image=f.image_file())
        url = reverse("photo-view", args=[photo.pk])
        for forwarded in (f"9.9.9.1, 81.2.3.4, {EDGE}", f"9.9.9.2, 81.2.3.4, {EDGE}"):
            self.api.post(url, {}, format="json", HTTP_X_FORWARDED_FOR=forwarded)
        photo.refresh_from_db()
        self.assertEqual(photo.views, 1)
        self.api.post(url, {}, format="json", HTTP_X_FORWARDED_FOR=f"81.2.3.5, {EDGE}")
        photo.refresh_from_db()
        self.assertEqual(photo.views, 2)
