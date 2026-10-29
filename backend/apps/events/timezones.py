"""Event times are typed and shown as wall-clock time in the event's own city."""

from zoneinfo import ZoneInfo

from django.utils import timezone


def to_city_wall_time(value, city):
    """A stored datetime as the naive wall-clock time in the event's city."""
    if value is None or city is None:
        return value
    return timezone.localtime(value, ZoneInfo(city.timezone)).replace(tzinfo=None)


def from_city_wall_time(value, city):
    """A datetime typed into a form, read as wall-clock time in the event's city.

    Django attaches the site's own time zone (Europe/Madrid) when it parses form
    input. We drop it and attach the city's zone, so 20:00 for a Lagos event means
    20:00 in Lagos.
    """
    if value is None or city is None:
        return value
    naive = timezone.make_naive(value) if timezone.is_aware(value) else value
    return timezone.make_aware(naive, ZoneInfo(city.timezone))
