"""Studio and the admin on their own host, HOY_STUDIO_HOST (studio.fromthehouseofyoung.com).

There Studio sits at the root, the admin under /admin/ and nothing else answers. Old /studio/ and
/admin/ links on any other host move there. With HOY_STUDIO_HOST unset (local work, tests) both
stay at /studio/ and /admin/ on whatever host is asked.
"""

from django.conf import settings
from django.http import HttpResponsePermanentRedirect
from django.http.request import split_domain_port
from django.urls import set_urlconf
from django.utils.encoding import escape_uri_path

STUDIO_URLCONF = "config.studio_urls"


def studio_path(path, on_studio_host):
    """Where an old Studio or admin path lives on the studio host, or None if it isn't one."""
    if path == "/studio" or path.startswith("/studio/"):
        return "/" + path.removeprefix("/studio").lstrip("/")
    if not on_studio_host and (path == "/admin" or path.startswith("/admin/")):
        return path
    return None


class StudioHostMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = settings.HOY_STUDIO_HOST
        if not host:
            return self.get_response(request)
        on_studio_host = split_domain_port(request.get_host())[0] == host
        moved = studio_path(request.path, on_studio_host)
        if moved is not None:
            query = request.META.get("QUERY_STRING", "")
            url = f"https://{host}{escape_uri_path(moved)}" + (f"?{query}" if query else "")
            # 308 keeps the method and body of a form posted from a page opened before the move.
            return HttpResponsePermanentRedirect(url, preserve_request=request.method not in ("GET", "HEAD"))
        if not on_studio_host:
            return self.get_response(request)
        request.urlconf = STUDIO_URLCONF
        set_urlconf(STUDIO_URLCONF)
        response = self.get_response(request)
        response["X-Robots-Tag"] = "noindex, nofollow"
        response.setdefault("Referrer-Policy", "same-origin")
        return response
