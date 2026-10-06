from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView

admin.site.site_header = "House of Young"
admin.site.site_title = "HOY admin"

urlpatterns = [
    path("", TemplateView.as_view(template_name="home.html"), name="home"),
    path("studio/", include("apps.studio.urls")),
    path("admin/", admin.site.urls),
    path("api/v1/", include("api.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
