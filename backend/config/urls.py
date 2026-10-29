from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView

from apps.core.public import preview

urlpatterns = [
    path("", include("apps.ticketing.urls")),
    path("", TemplateView.as_view(template_name="home.html"), name="home"),
    path("studio/", include("apps.studio.urls")),
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
]

if settings.DEBUG:
    urlpatterns += [path("preview/", preview, name="public-preview")]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
