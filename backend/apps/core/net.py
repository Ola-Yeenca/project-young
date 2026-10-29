"""The visitor's address, as our own proxy saw it.

Each proxy in front of the app (on Railway, its edge) appends the address it received the request
from to X-Forwarded-For. Everything to the left of those entries came from the visitor and can say
anything, so only the entry HOY_TRUSTED_PROXIES places from the right is trusted. DRF's throttles
make the same choice through NUM_PROXIES.
"""

import ipaddress

from django.conf import settings


def client_ip(request) -> str:
    remote = request.META.get("REMOTE_ADDR", "")
    proxies = settings.HOY_TRUSTED_PROXIES
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if not proxies or not forwarded:
        return remote
    hops = forwarded.split(",")
    hop = hops[-min(proxies, len(hops))].strip()
    try:
        return str(ipaddress.ip_address(hop))
    except ValueError:
        return remote
