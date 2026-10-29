"""The visitor's address, as our own proxies saw it.

Railway's edge throws away any X-Forwarded-For a visitor sends and writes "<visitor>, <edge node>".
A proxy that appends instead leaves the visitor's own entries on the left, where they can say
anything. Either way only the entry HOY_TRUSTED_PROXIES places from the right is trusted. DRF's
throttles make the same choice through NUM_PROXIES.
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
