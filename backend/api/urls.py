from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.register("cities", views.CityViewSet, basename="city")
router.register("events", views.EventViewSet, basename="event")
router.register("talent", views.TalentViewSet, basename="talent")
router.register("gallery", views.AlbumViewSet, basename="album")
router.register("products", views.ProductViewSet, basename="product")

urlpatterns = [
    path("", include(router.urls)),
    path("faqs/", views.FAQList.as_view(), name="faq-list"),
    path("radio/", views.TrackList.as_view(), name="radio"),
    path("site/", views.site, name="site"),
    path("health/", views.health, name="health"),
    path("enquiries/booking/", views.BookingEnquiryCreate.as_view(), name="booking-enquiry"),
    path("enquiries/contact/", views.ContactEnquiryCreate.as_view(), name="contact-enquiry"),
    path("community/", views.CommunityJoin.as_view(), name="community-join"),
    path("photos/<int:pk>/view/", views.PhotoView.as_view(), name="photo-view"),
    path("photos/<int:pk>/download/", views.PhotoDownload.as_view(), name="photo-download"),
]
