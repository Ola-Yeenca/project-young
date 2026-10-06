from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.core.models import City, MediaKind, SiteSettings
from apps.events.models import Event
from apps.gallery.models import Album, AlbumItem
from apps.shop.models import Product, ProductPrice
from apps.talent.models import Talent

from . import factories as f
from .base import HOYTestCase


class CityTests(HOYTestCase):
    def test_rejects_unknown_timezone(self):
        c = City(name="Accra", slug="accra", country="Ghana", currency="GHS", timezone="Africa/Nowhere")
        with self.assertRaises(ValidationError):
            c.full_clean()

    def test_currency_symbol(self):
        self.assertEqual(f.city("Lagos").currency_symbol, "₦")


class EventRulesTests(HOYTestCase):
    def setUp(self):
        self.vlc = f.city("Valencia")
        self.los = f.city("Lagos")

    def test_venue_must_be_in_event_city(self):
        e = Event(title="X", slug="x", city=self.vlc, venue=f.venue(self.los, "Landmark"), starts_at=timezone.now())
        with self.assertRaisesMessage(ValidationError, "is in Lagos, not Valencia"):
            e.full_clean()

    def test_end_must_follow_start(self):
        start = timezone.now()
        e = Event(title="X", slug="x", city=self.vlc, venue=f.venue(self.vlc), starts_at=start, ends_at=start - timedelta(hours=1))
        with self.assertRaises(ValidationError) as ctx:
            e.full_clean()
        self.assertIn("ends_at", ctx.exception.message_dict)

    def test_published_paid_event_needs_ticket_link(self):
        e = Event(
            title="X",
            slug="x",
            city=self.vlc,
            venue=f.venue(self.vlc),
            starts_at=timezone.now(),
            price_from=Decimal("10"),
            status=Event.Status.PUBLISHED,
        )
        with self.assertRaises(ValidationError) as ctx:
            e.full_clean()
        self.assertIn("ticket_url", ctx.exception.message_dict)

    def test_free_event_can_publish_without_ticket_link(self):
        e = Event(
            title="X",
            slug="x",
            city=self.vlc,
            venue=f.venue(self.vlc),
            starts_at=timezone.now(),
            price_from=Decimal("0"),
            status=Event.Status.PUBLISHED,
        )
        e.full_clean()
        self.assertTrue(e.is_free)

    def test_provider_falls_back_to_city(self):
        e = f.event(self.los, ticket_provider="")
        self.assertEqual(e.provider, "Tix.africa")

    def test_upcoming_past_and_featured(self):
        up = f.event(self.vlc, title="Soon", days=3, is_featured=True)
        f.event(self.vlc, title="Later", days=30)
        past = f.event(self.vlc, title="Gone", days=-10)
        f.event(self.vlc, title="Draft", days=5, status=Event.Status.DRAFT)
        self.assertEqual([e.title for e in Event.objects.upcoming()], ["Soon", "Later"])
        self.assertEqual(list(Event.objects.past()), [past])
        self.assertEqual(list(Event.objects.featured()), [up])

    def test_inactive_city_hides_events(self):
        f.event(self.vlc)
        self.vlc.is_active = False
        self.vlc.save()
        self.assertFalse(Event.objects.upcoming().exists())

    def test_lineup_names_combines_talent_and_extra(self):
        e = f.event(self.vlc, lineup_extra="Special guest, Surprise")
        e.lineup.add(f.talent(self.vlc))
        self.assertEqual(e.lineup_names, ["DJ Tolu", "Special guest", "Surprise"])


class MediaRulesTests(HOYTestCase):
    def test_photo_needs_image_and_video_needs_link(self):
        c = f.city()
        album = Album.objects.create(title="A", slug="a", city=c)
        with self.assertRaises(ValidationError):
            AlbumItem(album=album, kind=MediaKind.PHOTO).full_clean()
        with self.assertRaises(ValidationError):
            AlbumItem(album=album, kind=MediaKind.VIDEO).full_clean()
        AlbumItem(album=album, kind=MediaKind.VIDEO, video_url="https://youtube.com/watch?v=1").full_clean()


class TalentTests(HOYTestCase):
    def test_groups_and_links(self):
        c = f.city()
        t = f.talent(c, category="comedy", spotify_url="https://open.spotify.com/x", previous_work="Headline\n\nResidency ")
        self.assertEqual(t.group, "Hosts")
        self.assertEqual(t.links, [{"label": "Spotify", "url": "https://open.spotify.com/x"}])
        self.assertEqual(t.previous_work_list, ["Headline", "Residency"])

    def test_unpublished_hidden(self):
        c = f.city()
        f.talent(c, is_published=False)
        self.assertFalse(Talent.objects.published().exists())


class ShopTests(HOYTestCase):
    def test_price_must_be_positive_and_for_city_filter(self):
        vlc, los = f.city("Valencia"), f.city("Lagos")
        p = Product.objects.create(name="Tee", slug="tee", image=f.image_file(), is_published=True)
        with self.assertRaises(ValidationError):
            ProductPrice(product=p, city=vlc, amount=Decimal("0")).full_clean()
        ProductPrice.objects.create(product=p, city=vlc, amount=Decimal("30"))
        self.assertEqual(list(Product.objects.for_city(vlc)), [p])
        self.assertEqual(list(Product.objects.for_city(los)), [])


class SiteSettingsTests(HOYTestCase):
    def test_singleton(self):
        a = SiteSettings.load()
        b = SiteSettings(tagline="New")
        b.save()
        self.assertEqual(SiteSettings.objects.count(), 1)
        self.assertEqual(a.pk, b.pk)
        with self.assertRaises(ValidationError):
            a.delete()
