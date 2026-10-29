"""Gallery view and download counting.

Nothing identifying is stored: the visitor key is a keyed hash of the address and browser that
rotates daily, and a device key is kept only when the visitor opted in to device recognition.
"""

import hashlib
import hmac
import re

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.core.net import client_ip

from .models import AlbumItem, PhotoHit

DEVICE = re.compile(r"^[0-9a-f]{64}$")


def _key(*parts: str) -> str:
    msg = "\x1f".join(parts).encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:16]


def record(item: AlbumItem, kind: str, request, device: str = "") -> bool:
    """Count a view or download unless this visitor already did the same today."""
    day = timezone.localdate()
    visitor = _key("visitor", day.isoformat(), client_ip(request), request.META.get("HTTP_USER_AGENT", ""))
    device = _key("device", device) if DEVICE.match(device or "") else ""
    try:
        with transaction.atomic():
            PhotoHit.objects.create(item=item, kind=kind, visitor=visitor, device=device, day=day)
    except IntegrityError:
        return False
    field = "views" if kind == PhotoHit.Kind.VIEW else "downloads"
    AlbumItem.objects.filter(pk=item.pk).update(**{field: F(field) + 1})
    return True
