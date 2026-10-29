"""External ticket-link shape checks matching the public purchase button."""

import re
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

_https_url = URLValidator(schemes=["https"])
_reserved = re.compile(
    r"(^|\.)(localhost|localdomain|local|internal|lan|test|invalid|example)$"
    r"|(^|\.)example\.(com|org|net|test)$"
)
_label = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def usable_ticket_url(value):
    """Check URL shape only; this does not verify the provider or event identity."""
    if not value:
        return False
    try:
        _https_url(value)
        url = urlsplit(value)
        host = (url.hostname or "").lower().removesuffix(".")
        return (
            url.scheme == "https"
            and url.username is None
            and url.password is None
            and "." in host
            and not re.fullmatch(r"[\d.]+", host)
            and all(_label.fullmatch(part) for part in host.split("."))
            and not _reserved.search(host)
        )
    except (ValidationError, ValueError):
        return False
