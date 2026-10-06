import io
from datetime import timedelta
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from apps.core.models import City, Venue
from apps.events.models import Event
from apps.talent.models import Talent


def image_file(name="photo.jpg", colour=(200, 160, 70)):
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), colour).save(buf, "JPEG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


def city(name="Valencia", **kw):
    defaults = dict(
        slug=name.lower(),
        country="Spain" if name == "Valencia" else "Nigeria",
        currency="EUR" if name == "Valencia" else "NGN",
        timezone="Europe/Madrid" if name == "Valencia" else "Africa/Lagos",
        ticket_provider="Fourvenues" if name == "Valencia" else "Tix.africa",
    )
    defaults.update(kw)
    return City.objects.create(name=name, **defaults)


def venue(c, name="La3 Club"):
    return Venue.objects.create(city=c, name=name, slug=name.lower().replace(" ", "-"))


def talent(c, name="DJ Tolu", **kw):
    defaults = dict(slug=name.lower().replace(" ", "-"), category="dj", bio="Bio.", photo=image_file(), is_published=True)
    defaults.update(kw)
    return Talent.objects.create(name=name, city=c, **defaults)


def event(c, v=None, title="Afrobeats Night", days=10, **kw):
    defaults = dict(
        slug=title.lower().replace(" ", "-") + f"-{c.slug}",
        venue=v or venue(c, f"Venue {title}"),
        starts_at=timezone.now() + timedelta(days=days),
        price_from=Decimal("15"),
        ticket_url="https://example.com/t",
        status=Event.Status.PUBLISHED,
    )
    defaults.update(kw)
    return Event.objects.create(title=title, city=c, **defaults)
