from datetime import timedelta
from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import SiteSettings
from apps.enquiries.models import BookingEnquiry, ContactEnquiry
from apps.events.models import Event
from apps.gallery.models import Album, AlbumItem
from apps.shop.models import Product, ProductPrice

from . import factories as f
from .base import HOYTestCase


class ReadAPITests(HOYTestCase):
    def setUp(self):
        self.api = APIClient()
        self.vlc, self.los = f.city("Valencia"), f.city("Lagos")

    def test_health(self):
        self.assertEqual(self.api.get("/api/v1/health/").json(), {"status": "ok"})

    def test_cities_only_active(self):
        f.city("Accra", is_active=False, country="Ghana", currency="GHS", timezone="Africa/Accra")
        self.assertEqual([c["slug"] for c in self.api.get("/api/v1/cities/").json()], ["lagos", "valencia"])

    def test_events_filter_by_city_and_local_time(self):
        start = timezone.now().replace(microsecond=0) + timedelta(days=5)
        f.event(self.los, title="HOY Live", starts_at=start, price_from=Decimal("10000"))
        f.event(self.vlc, title="Afrobeats Night")
        data = self.api.get("/api/v1/events/?city=lagos").json()["results"]
        self.assertEqual([e["title"] for e in data], ["HOY Live"])
        self.assertEqual(data[0]["currency_symbol"], "₦")
        self.assertEqual(data[0]["local"]["timezone"], "Africa/Lagos")
        self.assertEqual(data[0]["ticket_provider"], "Tix.africa")

    def test_drafts_never_exposed(self):
        f.event(self.vlc, title="Secret", status=Event.Status.DRAFT)
        self.assertEqual(self.api.get("/api/v1/events/").json()["results"], [])
        self.assertEqual(self.api.get("/api/v1/events/secret-valencia/").status_code, 404)

    def test_past_and_featured_filters(self):
        f.event(self.vlc, title="Old", days=-20)
        f.event(self.vlc, title="Hot", is_featured=True)
        f.event(self.vlc, title="Cold")
        self.assertEqual([e["title"] for e in self.api.get("/api/v1/events/?when=past").json()["results"]], ["Old"])
        self.assertEqual([e["title"] for e in self.api.get("/api/v1/events/?featured=1").json()["results"]], ["Hot"])

    def test_unknown_city_is_404(self):
        self.assertEqual(self.api.get("/api/v1/events/?city=paris").status_code, 404)

    def test_talent_list_group_filter_and_detail(self):
        dj = f.talent(self.vlc, "DJ Tolu")
        f.talent(self.vlc, "MC Nene", category="host")
        f.talent(self.vlc, "Hidden", is_published=False)
        e = f.event(self.vlc)
        e.lineup.add(dj)
        names = [t["name"] for t in self.api.get("/api/v1/talent/?group=DJs").json()["results"]]
        self.assertEqual(names, ["DJ Tolu"])
        detail = self.api.get("/api/v1/talent/dj-tolu/").json()
        self.assertEqual(detail["upcoming_events"][0]["slug"], e.slug)
        self.assertEqual(self.api.get("/api/v1/talent/hidden/").status_code, 404)

    def test_gallery_detail_lists_items_in_order(self):
        album = Album.objects.create(title="Night", slug="night", city=self.vlc)
        AlbumItem.objects.create(album=album, kind="video", video_url="https://youtu.be/b", order=2)
        AlbumItem.objects.create(album=album, kind="video", video_url="https://youtu.be/a", order=1)
        items = self.api.get("/api/v1/gallery/night/").json()["items"]
        self.assertEqual([i["video_url"] for i in items], ["https://youtu.be/a", "https://youtu.be/b"])

    def test_products_priced_per_city(self):
        p = Product.objects.create(name="Tee", slug="tee", image=f.image_file(), is_published=True)
        ProductPrice.objects.create(product=p, city=self.vlc, amount=Decimal("30"))
        ProductPrice.objects.create(product=p, city=self.los, amount=Decimal("25000"))
        prices = self.api.get("/api/v1/products/?city=lagos").json()["results"][0]["prices"]
        self.assertEqual(prices, [{"city": "lagos", "amount": "25000.00", "currency": "NGN", "currency_symbol": "₦", "checkout_url": ""}])

    def test_api_is_read_only(self):
        self.assertEqual(self.api.post("/api/v1/events/", {"title": "x"}, format="json").status_code, 405)
        f.event(self.vlc)
        self.assertEqual(self.api.delete("/api/v1/events/afrobeats-night-valencia/").status_code, 405)


class EnquiryAPITests(HOYTestCase):
    def setUp(self):
        cache.clear()
        self.api = APIClient()
        self.los = f.city("Lagos")
        self.dj = f.talent(self.los, "DJ Kayz")
        site = SiteSettings.load()
        site.booking_email = "bookings@hoy.example"
        site.contact_email = "hello@hoy.example"
        site.save()

    def booking(self, **kw):
        data = dict(
            talent="dj-kayz",
            client_name="Ada",
            email="ada@example.com",
            event_date=str(timezone.localdate() + timedelta(days=60)),
            event_location="Lekki",
            event_type="private",
            expected_audience="100-300",
            privacy_accepted=True,
        )
        data.update(kw)
        return data

    def test_booking_creates_record_emails_and_returns_only_reference(self):
        with self.captureOnCommitCallbacks(execute=True):
            r = self.api.post("/api/v1/enquiries/booking/", self.booking(), format="json")
        self.assertEqual(r.status_code, 201, r.content)
        enquiry = BookingEnquiry.objects.get()
        self.assertEqual(r.json(), {"reference": enquiry.reference, "status": "received"})
        self.assertEqual(enquiry.city, self.los)
        self.assertEqual(enquiry.status, "new")
        self.assertEqual([m.to for m in mail.outbox], [["bookings@hoy.example"], ["ada@example.com"]])
        self.assertEqual(mail.outbox[0].reply_to, ["ada@example.com"])
        self.assertIn("DJ Kayz", mail.outbox[0].body)

    def test_phone_only_is_fine_but_one_contact_is_required(self):
        self.assertEqual(
            self.api.post("/api/v1/enquiries/booking/", self.booking(email="", phone="+234 801 234 5678"), format="json").status_code, 201
        )
        r = self.api.post("/api/v1/enquiries/booking/", self.booking(email="", phone=""), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("email", r.json())

    def test_past_date_and_missing_consent_rejected(self):
        r = self.api.post("/api/v1/enquiries/booking/", self.booking(event_date="2020-01-01"), format="json")
        self.assertIn("event_date", r.json())
        r = self.api.post("/api/v1/enquiries/booking/", self.booking(privacy_accepted=False), format="json")
        self.assertIn("privacy_accepted", r.json())

    def test_honeypot_rejects(self):
        r = self.api.post(
            "/api/v1/enquiries/contact/",
            {"name": "Bot", "email": "b@x.com", "message": "hi", "privacy_accepted": True, "website": "spam"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertFalse(ContactEnquiry.objects.exists())

    def test_contact_goes_to_contact_email(self):
        with self.captureOnCommitCallbacks(execute=True):
            r = self.api.post(
                "/api/v1/enquiries/contact/",
                {
                    "category": "press",
                    "name": "Bola",
                    "email": "bola@press.example",
                    "message": "Press kit please",
                    "privacy_accepted": True,
                },
                format="json",
            )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(mail.outbox[0].to, ["hello@hoy.example"])

    def test_email_failure_does_not_break_submission(self):
        with override_settings(EMAIL_BACKEND="tests.test_api.BrokenBackend"), self.captureOnCommitCallbacks(execute=True):
            r = self.api.post("/api/v1/enquiries/booking/", self.booking(), format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(BookingEnquiry.objects.count(), 1)

    @override_settings(
        REST_FRAMEWORK={
            "DEFAULT_THROTTLE_RATES": {"enquiries": "2/hour"},
            "DEFAULT_AUTHENTICATION_CLASSES": [],
            "UNAUTHENTICATED_USER": None,
        }
    )
    def test_rate_limited(self):
        from rest_framework.settings import api_settings
        from rest_framework.throttling import ScopedRateThrottle

        api_settings.reload()
        ScopedRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
        try:
            codes = [self.api.post("/api/v1/enquiries/booking/", self.booking(), format="json").status_code for _ in range(3)]
            self.assertEqual(codes, [201, 201, 429])
        finally:
            api_settings.reload()
            ScopedRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES


class BrokenBackend:
    def __init__(self, *a, **k):
        pass

    def send_messages(self, messages):
        raise ConnectionError("SMTP down")
