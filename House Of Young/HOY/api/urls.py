from rest_framework.routers import DefaultRouter
from core.api.urls import event_router
from django.urls import path, include




router = DefaultRouter()
router.registry.extend(event_router.registry)


urlpatterns = [
    path('', include(router.urls)),
]
