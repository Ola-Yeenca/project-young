"""Load the sample content used in the clickable prototype.

For local development and staging only. Every record it creates is sample data:
the artists, prices and venues listings are placeholders, not real bookings.
"""

import io
import random
from datetime import timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFilter

from apps.core.models import FAQ, City, SiteSettings, Venue
from apps.events.models import Event
from apps.gallery.models import Album, AlbumItem
from apps.shop.models import Product, ProductPrice, ProductVariant
from apps.talent.models import Talent

PALETTES = [
    ((125, 26, 31), (224, 149, 79), (242, 220, 185)),
    ((20, 35, 31), (201, 160, 67), (63, 107, 90)),
    ((38, 55, 95), (217, 195, 160), (155, 58, 44)),
    ((58, 42, 74), (208, 138, 62), (242, 226, 198)),
    ((111, 38, 56), (234, 163, 108), (42, 26, 23)),
    ((18, 58, 51), (229, 195, 122), (240, 232, 216)),
]


def placeholder(seed, size=(800, 1000)):
    """A soft colour-field JPEG standing in for a real photo."""
    rnd = random.Random(seed)
    base, a, b = PALETTES[seed % len(PALETTES)]
    img = Image.new("RGB", size, base)
    draw = ImageDraw.Draw(img)
    for i in range(6):
        colour = a if i % 2 else b
        r = rnd.randint(size[0] // 4, size[0])
        x, y = rnd.randint(0, size[0]), rnd.randint(0, size[1])
        draw.ellipse((x - r, y - r, x + r, y + r), fill=colour)
    img = img.filter(ImageFilter.GaussianBlur(radius=size[0] // 6))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return ContentFile(buf.getvalue(), name=f"sample-{seed}.jpg")


CITIES = [
    dict(
        name="Valencia",
        country="Spain",
        currency="EUR",
        timezone="Europe/Madrid",
        ticket_provider="Fourvenues",
        whatsapp_number="+34 600 000 000",
        order=1,
    ),
    dict(
        name="Lagos",
        country="Nigeria",
        currency="NGN",
        timezone="Africa/Lagos",
        ticket_provider="Tix.africa",
        whatsapp_number="+234 800 000 0000",
        order=2,
    ),
]

VENUES = {
    "Valencia": ["La3 Club", "Marina Beach Club", "Espai Rambleta", "Mya Club"],
    "Lagos": ["Landmark Beach, Oniru", "The Backyard, VI", "Alliance Française, Ikoyi", "Muri Okunola Park"],
}

TALENT = {
    "Valencia": [
        ("Kemi Adé", "vocalist", "Afrobeats", "Lagos-born, Valencia-based singer. Headlined four HOY nights in 2026."),
        ("DJ Tolu", "dj", "Afrobeats, Amapiano", "Resident DJ for HOY Valencia. Two-hour sets from classic Afrobeats into Amapiano."),
        ("Lagos Collective", "dance", "Afro-fusion", "Six-piece crew for stage shows, launches and music videos."),
        ("MC Nene", "host", "Bilingual host", "English and Spanish host for events, award nights and activations."),
        ("Sade Rivera", "dj", "Afro house", "Late-slot specialist. Deep Afro house for the last two hours."),
    ],
    "Lagos": [
        ("Zara Obi", "vocalist", "Afropop", "Lagos singer with two EPs. Plays with a four-piece band or acoustic."),
        ("DJ Kayz", "dj", "Afrobeats, Amapiano", "Mainland-raised, Island-booked. Open-format rooftop sets."),
        ("Ebun & The Band", "band", "Highlife, Afro-jazz", "Seven-piece band for weddings, galas and concerts."),
        ("Tobi K", "comedy", "Stand-up, hosting", "Stand-up and event host for brand events and award nights."),
        ("Ife Sounds", "dj", "Afro house", "Sunset and afters specialist across the Island."),
    ],
}

EVENTS = {
    "Valencia": [
        (
            "Afrobeats Night",
            0,
            12,
            "23:00",
            "club",
            "afrobeats",
            104,
            Decimal("15"),
            72,
            "The night that started it all. Every word sung back.",
            [0, 1, 4],
        ),
        (
            "Amapiano Sunset",
            1,
            27,
            "18:00",
            "day",
            "amapiano",
            112,
            Decimal("12"),
            41,
            "Log drums, salt air, an early finish on the marina.",
            [4, 1],
        ),
        (
            "Open Mic",
            2,
            40,
            "20:00",
            "live",
            "afrobeats",
            92,
            Decimal("0"),
            None,
            "One mic, new voices from the roster and the city. Free.",
            [0, 3],
        ),
        ("Detty December", 3, 61, "23:30", "club", "amapiano", 110, Decimal("18"), 9, "The send-off before everyone flies home.", [1, 2]),
    ],
    "Lagos": [
        (
            "HOY Live Lagos",
            0,
            19,
            "20:00",
            "live",
            "afrobeats",
            102,
            Decimal("10000"),
            64,
            "Live sets on the sand. Doors at sunset.",
            [0, 1, 3],
        ),
        (
            "Rooftop Sessions 3",
            1,
            33,
            "19:00",
            "live",
            "highlife",
            96,
            Decimal("7500"),
            47,
            "Highlife, a rooftop and the Island skyline.",
            [2, 4],
        ),
        ("Industry Mixer", 2, 46, "18:00", "talk", "mixed", 100, Decimal("0"), 80, "Invite-only. Free with registration.", [3]),
        (
            "Detty December Opening",
            3,
            68,
            "21:00",
            "club",
            "amapiano",
            113,
            Decimal("15000"),
            100,
            "Sold out. The waitlist is open.",
            [1, 0],
        ),
    ],
}

FAQS = [
    (
        "tickets",
        "How do I buy tickets?",
        "Every event has a Buy tickets button. It opens our ticket partner for that city, where you pay and get a QR ticket by email.",
    ),
    (
        "talent",
        "How do I book an artist?",
        "Open the artist and send an enquiry with date, location and audience. We reply within one working day with availability and a quote.",
    ),
    (
        "collaboration",
        "Can we collaborate on an event?",
        "Yes. Use the contact form, pick Event collaboration and tell us the venue, date and what you bring.",
    ),
    ("talent", "Do you work outside Valencia and Lagos?", "We travel for the right booking. Send the location and we will confirm."),
    ("other", "Press and media", "Pick Media / Press in the contact form and we send the press kit."),
]

PRODUCTS = [
    ("Heavyweight Tee", "240 gsm cotton", "Boxy", ["S", "M", "L", "XL"], {"Valencia": "30", "Lagos": "25000"}),
    ("Gold Mark Cap", "Washed cotton", "One size", ["One size"], {"Valencia": "25", "Lagos": "18000"}),
    ("City Hoodie", "400 gsm fleece", "Relaxed", ["S", "M", "L", "XL"], {"Valencia": "55", "Lagos": "45000"}),
]


class Command(BaseCommand):
    help = "Load the prototype's sample content (cities, venues, events, talent, gallery, merch, FAQs)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Run even if events already exist.")

    @transaction.atomic
    def handle(self, *args, force=False, **options):
        if Event.objects.exists() and not force:
            raise CommandError("There is already content in the database. Use --force to add the sample data anyway.")
        seed = 1
        now = timezone.now()
        site = SiteSettings.load()
        site.about = "House of Young started as a collective putting on nights for the African diaspora in Valencia. It grew into an entertainment company with a second home in Lagos."
        site.save()

        for row in CITIES:
            city, _ = City.objects.update_or_create(slug=slugify(row["name"]), defaults=row)
            tz = ZoneInfo(city.timezone)
            venues = []
            for name in VENUES[city.name]:
                venue, _ = Venue.objects.get_or_create(city=city, slug=slugify(name), defaults={"name": name})
                venues.append(venue)

            talent = []
            for i, (name, category, genre, bio) in enumerate(TALENT[city.name]):
                person, created = Talent.objects.get_or_create(
                    slug=slugify(name),
                    defaults=dict(
                        name=name,
                        city=city,
                        category=category,
                        genre=genre,
                        bio=bio,
                        is_published=True,
                        is_featured=i < 3,
                        featured_order=i,
                        instagram_url="https://instagram.com/",
                    ),
                )
                if created:
                    person.photo.save(f"{person.slug}.jpg", placeholder(seed), save=True)
                seed += 1
                talent.append(person)

            for title, venue_i, days, doors, kind, style, bpm, price, sold, caption, lineup in EVENTS[city.name]:
                hour, minute = map(int, doors.split(":"))
                local_day = (now + timedelta(days=days)).astimezone(tz)
                starts = local_day.replace(hour=hour, minute=minute, second=0, microsecond=0)
                event, created = Event.objects.get_or_create(
                    slug=slugify(f"{title}-{city.slug}"),
                    defaults=dict(
                        title=title,
                        city=city,
                        venue=venues[venue_i],
                        kind=kind,
                        starts_at=starts,
                        music_style=style,
                        bpm=bpm,
                        price_from=price,
                        sold_percent=sold if sold and sold < 100 else None,
                        sold_out=sold == 100,
                        caption=caption,
                        ticket_url="https://example.com/tickets",
                        status=Event.Status.PUBLISHED,
                        is_featured=True,
                        featured_order=venue_i,
                    ),
                )
                if created:
                    event.lineup.set([talent[i] for i in lineup])
                    event.poster.save(f"{event.slug}.jpg", placeholder(seed, (1000, 1000)), save=True)
                seed += 1

            album = Album.objects.filter(slug=f"highlights-{city.slug}").first()
            if album is None:
                album = Album.objects.create(title=f"{city.name} highlights", slug=f"highlights-{city.slug}", city=city, date=now.date())
                for n in range(6):
                    item = AlbumItem(album=album, order=n)
                    item.image.save(f"{album.slug}-{n}.jpg", placeholder(seed + n, (1200, 900)), save=False)
                    item.save()
                seed += 6

        for i, (category, q, a) in enumerate(FAQS):
            FAQ.objects.get_or_create(question=q, defaults=dict(category=category, answer=a, order=i))

        cities = {c.name: c for c in City.objects.all()}
        for i, (name, material, fit, sizes, prices) in enumerate(PRODUCTS):
            product, created = Product.objects.get_or_create(
                slug=slugify(name), defaults=dict(name=name, material=material, fit=fit, is_published=True, order=i)
            )
            if created:
                product.image.save(f"{product.slug}.jpg", placeholder(seed, (900, 900)), save=True)
                for j, label in enumerate(sizes):
                    ProductVariant.objects.create(product=product, label=label, order=j)
                for city_name, amount in prices.items():
                    ProductPrice.objects.create(product=product, city=cities[city_name], amount=Decimal(amount))
            seed += 1

        self.stdout.write(self.style.SUCCESS("Sample content loaded. Every record is placeholder data."))
