"""URLs on HOY_STUDIO_HOST (see apps.studio.middleware): Studio at the root, the admin, no public API."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.studio.views import robots

urlpatterns = [
    path("robots.txt", robots),
    path("admin/", admin.site.urls),
    path("", include("apps.studio.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
