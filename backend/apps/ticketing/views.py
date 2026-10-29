import json

from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from apps.events.models import Event

from .client import CommerceError, NochevaClient, identifier, local_enabled


def mapping_for(slug):
    if not local_enabled():
        raise Http404
    event = get_object_or_404(Event.objects.published().select_related("city", "venue", "ticketing_mapping"), slug=slug)
    try:
        mapping = event.ticketing_mapping
    except Event.ticketing_mapping.RelatedObjectDoesNotExist as exc:
        raise Http404 from exc
    if not mapping.enabled or not mapping.commerce_event_id:
        raise Http404
    return event, mapping


def result(data, status=200):
    response = JsonResponse(data, status=status, safe=isinstance(data, dict))
    response["Referrer-Policy"] = "no-referrer"
    return response


def body_of(request):
    if request.content_type != "application/json" or len(request.body) > 16384:
        raise CommerceError("invalid_request", 422)
    try:
        value = json.loads(request.body)
    except ValueError as exc:
        raise CommerceError("invalid_request", 422) from exc
    if not isinstance(value, dict):
        raise CommerceError("invalid_request", 422)
    return value


def token_of(request):
    token = request.headers.get("X-Order-Token", "")
    if not token:
        raise CommerceError("order_token_required", 401)
    if len(token) > 1000 or "\n" in token or "\r" in token:
        raise CommerceError("invalid_order_token", 401)
    return {"X-Order-Token": token}


def matching_order(client, mapping, order_id, headers):
    order = client.request(f"/orders/{identifier(order_id)}", headers=headers)
    if order.get("event_id") != mapping.commerce_event_id:
        raise CommerceError("order_not_found", 404)
    return order


def public_order(order):
    # Private recovery token is returned only by reservation. QR tokens stay upstream.
    order = dict(order)
    order["tickets"] = [{"id": t["id"], "status": t["status"]} for t in order.get("tickets", [])]
    return order


@never_cache
@ensure_csrf_cookie
@require_http_methods(["GET"])
def buyer(request, slug):
    event, mapping = mapping_for(slug)
    return render(request, "ticketing/buyer.html", {"event": event, "commerce_event_id": mapping.commerce_event_id})


@never_cache
@require_http_methods(["GET"])
def availability(request, slug):
    event, mapping = mapping_for(slug)
    try:
        client = NochevaClient()
        if mapping.organizer_id != client.organizer:
            raise CommerceError("event_not_available", 404)
        meta = client.request(f"/events/{identifier(mapping.commerce_event_id)}")
        if meta.get("id") != mapping.commerce_event_id or meta.get("organizer_id") != mapping.organizer_id:
            raise CommerceError("event_not_available", 404)
        state = (
            "cancelled"
            if event.status == Event.Status.CANCELLED or meta.get("status") != "published"
            else "closed"
            if event.is_past
            else "available"
        )
        if state == "available" and meta.get("available", 0) <= 0:
            state = "sold_out"
        return result(
            {
                "id": meta["id"],
                "currency": meta["currency"],
                "available": meta["available"],
                "tiers": meta["tiers"],
                "state": state,
                "mode": "simulation",
            }
        )
    except CommerceError as exc:
        return result({"code": exc.code, "state": "unavailable"}, exc.status)


@never_cache
@require_http_methods(["POST"])
def reserve(request, slug):
    event, mapping = mapping_for(slug)
    try:
        if event.status == Event.Status.CANCELLED:
            raise CommerceError("event_cancelled", 409)
        if event.is_past:
            raise CommerceError("event_not_available", 409)
        key = request.headers.get("Idempotency-Key", "")
        if not 16 <= len(key) <= 200:
            raise CommerceError("invalid_idempotency_key", 422)
        client = NochevaClient()
        if mapping.organizer_id != client.organizer:
            raise CommerceError("event_not_available", 404)
        order = client.request(
            f"/events/{identifier(mapping.commerce_event_id)}/orders",
            method="POST",
            body=body_of(request),
            headers={"Idempotency-Key": key},
        )
        if order.get("event_id") != mapping.commerce_event_id:
            raise CommerceError()
        return result(public_order(order), 201)
    except CommerceError as exc:
        return result({"code": exc.code}, exc.status)


@never_cache
@require_http_methods(["GET", "POST"])
def order_action(request, slug, order_id, action="", ticket_id=""):
    event, mapping = mapping_for(slug)
    try:
        expected = "POST" if action in {"checkout", "simulate"} else "GET"
        if request.method != expected:
            response = result({"code": "method_not_allowed"}, 405)
            response["Allow"] = expected
            return response
        client = NochevaClient()
        if mapping.organizer_id != client.organizer:
            raise CommerceError("event_not_available", 404)
        headers = token_of(request)
        order = matching_order(client, mapping, order_id, headers)
        if action == "qr":
            ticket_id = identifier(ticket_id)
            if (
                event.status == Event.Status.CANCELLED
                or order.get("status") != "paid"
                or not any(t["id"] == ticket_id and t["status"] == "valid" for t in order.get("tickets", []))
            ):
                raise CommerceError("ticket_not_found", 404)
            svg = client.request(f"/orders/{order_id}/tickets/{ticket_id}/qr.svg", headers=headers, svg=True)
            response = HttpResponse(svg, content_type="image/svg+xml")
            response["X-Content-Type-Options"] = "nosniff"
            response["Referrer-Policy"] = "no-referrer"
            return response
        if action in {"checkout", "simulate"} and event.status == Event.Status.CANCELLED:
            raise CommerceError("event_cancelled", 409)
        if action in {"checkout", "simulate"} and event.is_past:
            raise CommerceError("event_not_available", 409)
        if action == "checkout":
            checkout = client.request(f"/orders/{order_id}/checkout", method="POST", headers=headers)
            if checkout.get("mode") != "simulation":
                raise CommerceError("synthetic_provider_required", 503)
            return result(checkout)
        if action == "simulate":
            if order.get("status") == "paid":
                return result(public_order(order))
            reference = order.get("provider_reference")
            if order.get("status") != "held" or not reference:
                raise CommerceError("order_not_payable", 409)
            # Only the authenticated mapped order's reference reaches the staff action.
            client.request(
                "/review/payments/simulate-success",
                method="POST",
                body={"reference": reference},
                headers={"Authorization": client.staff_authorization()},
            )
            return result(public_order(matching_order(client, mapping, order_id, headers)))
        return result(public_order(order))
    except CommerceError as exc:
        return result({"code": exc.code}, exc.status)
