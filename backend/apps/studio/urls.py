from django.urls import path

from . import views

app_name = "studio"

urlpatterns = [
    path("", views.overview, name="overview"),
    path("login/", views.StudioLogin.as_view(), name="login"),
    path("logout/", views.StudioLogout.as_view(), name="logout"),
    path("scope/<slug:slug>/", views.set_scope, name="scope"),
    path("search/", views.search, name="search"),
    path("enquiries/", views.enquiries, name="enquiries"),
    path("enquiries/<str:key>/update/", views.enquiry_update, name="enquiry_update"),
    path("events/", views.events, name="events"),
    path("events/new/", views.event_edit, name="event_new"),
    path("events/<int:pk>/", views.event_edit, name="event_edit"),
    path("events/<int:pk>/toggle/<str:field>/", views.event_toggle, name="event_toggle"),
    path("talent/", views.talent, name="talent"),
    path("talent/new/", views.talent_edit, name="talent_new"),
    path("talent/<int:pk>/", views.talent_edit, name="talent_edit"),
    path("talent/<int:pk>/toggle/<str:field>/", views.talent_toggle, name="talent_toggle"),
    path("gallery/", views.gallery, name="gallery"),
    path("gallery/new/", views.album_edit, name="album_new"),
    path("gallery/<int:pk>/", views.album_edit, name="album_edit"),
    path("shop/", views.shop, name="shop"),
    path("shop/new/", views.product_edit, name="product_new"),
    path("shop/<int:pk>/", views.product_edit, name="product_edit"),
    path("content/", views.content, name="content"),
    path("cities/", views.cities, name="cities"),
    path("cities/new/", views.city_edit, name="city_new"),
    path("cities/<int:pk>/", views.city_edit, name="city_edit"),
]
