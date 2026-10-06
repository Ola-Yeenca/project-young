"""Development-only connected preview of the reviewed public-site prototype."""

from django.conf import settings
from django.http import Http404, HttpResponse


def preview(request):
    if not settings.DEBUG:
        raise Http404
    source = settings.BASE_DIR.parent / "prototype" / "index.html"
    if not source.is_file():
        raise Http404
    assets = '<link rel="stylesheet" href="/static/hoy/live-content.css"><script src="/static/hoy/live-content.js" defer></script>'
    html = source.read_text(encoding="utf-8")
    closing_tag = "</body>" if "</body>" in html else "</html>"
    response = HttpResponse(html.replace(closing_tag, assets + closing_tag))
    response["Cache-Control"] = "no-store"
    return response
