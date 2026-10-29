"""Anonymous visitor codes for counting and de-duplicating without storing who someone is.

A code is a keyed hash cut to 16 hex characters; without the secret key it can't be linked back
to the address, browser or token it came from.
"""

import hashlib
import hmac

from django.conf import settings
from rest_framework.throttling import BaseThrottle


def visitor_key(*parts: str) -> str:
    msg = "\x1f".join(parts).encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:16]


def client_ip(request) -> str:
    """The visitor's address as the API's rate limits see it.

    The app's only reader of proxy headers. X-Forwarded-For is trusted as far as DRF's NUM_PROXIES
    allows, never by taking its client-written left-most entry.
    """
    return BaseThrottle().get_ident(request)
