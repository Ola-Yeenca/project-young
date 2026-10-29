"""Anonymous visitor codes for counting and de-duplicating without storing who someone is.

A code is a keyed hash cut to 16 hex characters; without the secret key it can't be linked back
to the address, browser or token it came from.
"""

import hashlib
import hmac

from django.conf import settings


def visitor_key(*parts: str) -> str:
    msg = "\x1f".join(parts).encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:16]


def client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")
