from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from apps.core.models import City, SiteSettings
from apps.enquiries.models import BookingEnquiry, ContactEnquiry
from apps.events.models import Event
from apps.gallery.models import Album

from .access import current_city


def setup_steps():
    """Real launch checklist shown in the sidebar until everything is done."""
    site = SiteSettings.load()
    upcoming = Event.objects.upcoming()
    return [
        {"label": "Set where enquiries go", "done": bool(site.booking_email or site.contact_email), "url": reverse("studio:content")},
        {
            "label": "Invite a team member",
            "done": get_user_model().objects.filter(is_staff=True, is_superuser=False, is_active=True).exists(),
            "url": reverse("admin:auth_user_add"),
        },
        {
            "label": "Give every upcoming event a poster",
            "done": upcoming.exists() and not upcoming.filter(poster="").exists(),
            "url": reverse("studio:events"),
        },
        {
            "label": "Publish a gallery album",
            "done": Album.objects.published().filter(items__isnull=False).exists(),
            "url": reverse("studio:gallery"),
        },
    ]


def studio(request):
    if (
        not request.path.startswith("/studio/")
        or not getattr(request, "user", None)
        or not request.user.is_authenticated
        or not request.user.is_staff
    ):
        return {}
    city = current_city(request)
    filt = {"city": city} if city else {}
    new = BookingEnquiry.objects.filter(status="new", **filt).count() + ContactEnquiry.objects.filter(status="new", **filt).count()
    upcoming = Event.objects.upcoming().filter(**filt).count()
    cities = list(City.objects.order_by("order", "name"))
    now = timezone.now()
    clocks = [{"name": c.name, "tz": c.timezone, "time": timezone.localtime(now, ZoneInfo(c.timezone)).strftime("%H:%M")} for c in cities]
    steps = setup_steps()
    done = sum(s["done"] for s in steps)
    next_step = next((s for s in steps if not s["done"]), None)
    return {
        "scope_city": city,
        "scope_cities": cities,
        "new_enquiries": new,
        "upcoming_count": upcoming,
        "clocks": clocks,
        "today": timezone.localtime(now),
        "setup": {"steps": steps, "done": done, "total": len(steps), "pct": round(done / len(steps) * 100), "next": next_step},
    }
