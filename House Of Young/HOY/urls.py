from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
import debug_toolbar


urlpatterns = [
        path('admin/', admin.site.urls),
        path('', include('core.urls')),
        path('api/', include('core.api.urls')),
        path('accounts/', include('accounts.urls')),
        # path('__debug__/', include('debug_toolbar.urls')),
    ]
# if settings.DEBUG:

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
