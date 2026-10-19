from django.urls import path

from . import views

app_name = "ticketing"
urlpatterns = [
    path("tickets/<slug:slug>/", views.buyer, name="buyer"),
    path("api/v1/commerce/events/<slug:slug>/", views.availability, name="availability"),
    path("api/v1/commerce/events/<slug:slug>/orders/", views.reserve, name="reserve"),
    path("api/v1/commerce/events/<slug:slug>/orders/<str:order_id>/", views.order_action, name="order"),
    path("api/v1/commerce/events/<slug:slug>/orders/<str:order_id>/checkout/", views.order_action, {"action": "checkout"}, name="checkout"),
    path("api/v1/commerce/events/<slug:slug>/orders/<str:order_id>/simulate/", views.order_action, {"action": "simulate"}, name="simulate"),
    path(
        "api/v1/commerce/events/<slug:slug>/orders/<str:order_id>/tickets/<str:ticket_id>/qr.svg",
        views.order_action,
        {"action": "qr"},
        name="qr",
    ),
]
