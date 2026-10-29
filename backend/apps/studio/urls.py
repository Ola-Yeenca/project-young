from django.urls import path

from . import crowd, views

app_name = "studio"

urlpatterns = [
    path("", views.overview, name="overview"),
    path("login/", views.StudioLogin.as_view(), name="login"),
    path("logout/", views.StudioLogout.as_view(), name="logout"),
    path("scope/<slug:slug>/", views.set_scope, name="scope"),
    path("search/", views.search, name="search"),
    path("enquiries/", views.enquiries, name="enquiries"),
    path("enquiries/<str:key>/update/", views.enquiry_update, name="enquiry_update"),
    path("community/", views.community, name="community"),
    path("community/<int:pk>/update/", views.member_update, name="member_update"),
    path("crowd/", crowd.overview, name="crowd"),
    path("crowd/djs/", crowd.dj_create, name="dj_create"),
    path("crowd/djs/<int:pk>/", crowd.dj_update, name="dj_update"),
    path("crowd/<int:pk>/", crowd.board, name="crowd_event"),
    path("crowd/<int:pk>/hide/", crowd.hide_song, name="crowd_hide"),
    path("crowd/<int:pk>/qr/", crowd.qr, name="crowd_qr"),
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
    path("radio/", views.radio, name="radio"),
    path("radio/<int:pk>/update/", views.track_update, name="track_update"),
    path("shop/", views.shop, name="shop"),
    path("shop/new/", views.product_edit, name="product_new"),
    path("shop/<int:pk>/", views.product_edit, name="product_edit"),
    path("content/", views.content, name="content"),
    path("choices/<slug:kind>/new/", views.choice_create, name="choice_create"),
    path("cities/", views.cities, name="cities"),
    path("cities/new/", views.city_edit, name="city_new"),
    path("cities/<int:pk>/", views.city_edit, name="city_edit"),
]
