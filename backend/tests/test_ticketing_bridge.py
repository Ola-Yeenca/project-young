import io
import json
import tempfile
from copy import deepcopy
from datetime import timedelta
from pathlib import Path
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import Client, SimpleTestCase, override_settings
from django.utils import timezone

from apps.events.models import Event
from apps.ticketing.client import CommerceError, NochevaClient, NoRedirect
from apps.ticketing.models import EventMapping

from . import factories as f
from .base import HOYTestCase


@override_settings(DEBUG=True, HOY_NOCHEVA_LOCAL=True)
class TicketingBridgeTests(HOYTestCase):
    def setUp(self):
        self.event = f.event(f.city())
        self.mapping = EventMapping.objects.create(
            event=self.event,
            organizer_id="org_hoy",
            commerce_event_id="commerce_hoy",
            enabled=True,
        )
        self.prefix = f"/api/v1/commerce/events/{self.event.slug}/"
        self.order = {
            "id": "order_hoy",
            "event_id": "commerce_hoy",
            "status": "held",
            "provider_reference": "reference_hoy",
            "currency": "EUR",
            "total_minor": 1500,
            "items": [{"tier_id": "tier_hoy", "quantity": 1}],
            "tickets": [],
        }
        self.client_patch = patch("apps.ticketing.views.NochevaClient")
        self.upstream = self.client_patch.start().return_value
        self.addCleanup(self.client_patch.stop)
        self.upstream.organizer = "org_hoy"
        self.upstream.request.return_value = deepcopy(self.order)
        self.headers = {"HTTP_X_ORDER_TOKEN": "private-test-recovery"}

    def post(self, path, body=None, **headers):
        return self.client.post(self.prefix + path, json.dumps(body or {}), content_type="application/json", **headers)

    def test_buyer_has_brand_csrf_and_no_upstream_credential(self):
        response = self.client.get(f"/tickets/{self.event.slug}/")
        self.assertContains(response, "House of Young")
        self.assertContains(response, "Nocheva")
        self.assertContains(response, "Event organizer")
        self.assertContains(response, "Ticket platform")
        self.assertContains(response, "not valid for admission")
        self.assertContains(response, 'data-commerce-event-id="commerce_hoy"')
        self.assertIn("csrftoken", response.cookies)
        self.assertEqual(response["Cache-Control"].split(",")[-1].strip(), "private")
        self.upstream.request.assert_not_called()

    def test_serialized_checkout_exists_only_for_enabled_upcoming_mapping(self):
        data = self.client.get(f"/api/v1/events/{self.event.slug}/").json()
        self.assertEqual(data["checkout_url"], f"/tickets/{self.event.slug}/")
        self.assertEqual(data["ticketing_mode"], "simulation")
        self.mapping.enabled = False
        self.mapping.save()
        self.assertEqual(self.client.get(f"/api/v1/events/{self.event.slug}/").json()["checkout_url"], "")

    @override_settings(HOY_NOCHEVA_LOCAL=False)
    def test_disabled_adapter_and_serializer(self):
        self.assertEqual(self.client.get(f"/tickets/{self.event.slug}/").status_code, 404)
        self.assertEqual(self.client.get(self.prefix).status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/events/{self.event.slug}/").json()["checkout_url"], "")

    @override_settings(DEBUG=False)
    def test_adapter_is_unavailable_in_production(self):
        self.assertEqual(self.client.get(self.prefix).status_code, 404)
        self.assertEqual(self.post("orders/").status_code, 404)
        self.assertEqual(self.post("orders/order_hoy/simulate/", **self.headers).status_code, 404)
        self.upstream.request.assert_not_called()

    def test_hidden_city_draft_and_missing_mapping_fail_closed(self):
        for field, value in [("status", Event.Status.DRAFT)]:
            setattr(self.event, field, value)
            self.event.save()
            self.assertEqual(self.client.get(self.prefix).status_code, 404)
        self.event.status = Event.Status.PUBLISHED
        self.event.save()
        self.event.city.is_active = False
        self.event.city.save()
        self.assertEqual(self.client.get(self.prefix).status_code, 404)
        self.event.city.is_active = True
        self.event.city.save()
        self.mapping.delete()
        self.assertEqual(self.client.get(f"/tickets/{self.event.slug}/").status_code, 404)
        self.upstream.request.assert_not_called()

    def test_availability_uses_upstream_stock_and_price(self):
        self.upstream.request.return_value = {
            "id": "commerce_hoy",
            "organizer_id": "org_hoy",
            "currency": "EUR",
            "available": 3,
            "tiers": [{"id": "tier_hoy", "price_minor": 1999, "available": 3}],
            "status": "published",
        }
        response = self.client.get(self.prefix)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["tiers"][0]["price_minor"], 1999)
        self.assertEqual(response.json()["available"], 3)
        self.upstream.request.return_value["available"] = 0
        self.assertEqual(self.client.get(self.prefix).json()["state"], "sold_out")

    def test_wrong_organizer_is_not_served(self):
        self.upstream.organizer = "another_organizer"
        self.assertEqual(self.post("orders/", HTTP_IDEMPOTENCY_KEY="a-unique-request-key").status_code, 404)
        self.upstream.request.assert_not_called()

    def test_reservation_forwards_exact_intent_key_and_private_recovery(self):
        body = {"email": "buyer@example.test", "items": [{"tier_id": "tier_hoy", "quantity": 1}]}
        self.upstream.request.return_value = {**self.order, "recovery_token": "private-recovery"}
        response = self.post("orders/", body, HTTP_IDEMPOTENCY_KEY="same-request-on-retry")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["recovery_token"], "private-recovery")
        self.upstream.request.assert_called_once_with(
            "/events/commerce_hoy/orders",
            method="POST",
            body=body,
            headers={"Idempotency-Key": "same-request-on-retry"},
        )

    def test_missing_idempotency_and_invalid_json_never_create_order(self):
        self.assertEqual(self.post("orders/").status_code, 422)
        response = self.client.post(
            self.prefix + "orders/",
            "{bad",
            content_type="application/json",
            HTTP_IDEMPOTENCY_KEY="valid-request-key",
        )
        self.assertEqual(response.status_code, 422)
        self.upstream.request.assert_not_called()

    def test_missing_recovery_and_wrong_token_do_not_expose_order(self):
        self.assertEqual(self.client.get(self.prefix + "orders/order_hoy/").status_code, 401)
        self.upstream.request.side_effect = CommerceError("invalid_order_token", 403)
        response = self.client.get(self.prefix + "orders/order_hoy/", **self.headers)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("id", response.json())

    def test_cross_event_order_cannot_checkout_or_simulate_or_fetch_qr(self):
        self.upstream.request.return_value = {**self.order, "event_id": "another_event"}
        for action in ["checkout/", "simulate/"]:
            self.upstream.request.reset_mock()
            self.assertEqual(self.post("orders/order_hoy/" + action, **self.headers).status_code, 404)
            self.assertEqual(self.upstream.request.call_count, 1)
        self.assertEqual(self.client.get(self.prefix + "orders/order_hoy/tickets/a/qr.svg", **self.headers).status_code, 404)

    def test_order_read_removes_ticket_tokens_and_does_not_reserve(self):
        self.upstream.request.return_value = {**self.order, "tickets": [{"id": "ticket_hoy", "status": "valid", "token": "private-qr"}]}
        response = self.client.get(self.prefix + "orders/order_hoy/", **self.headers)
        self.assertEqual(response.json()["tickets"], [{"id": "ticket_hoy", "status": "valid"}])
        self.upstream.request.assert_called_once_with("/orders/order_hoy", headers={"X-Order-Token": "private-test-recovery"})
        self.assertIn("no-store", response["Cache-Control"])

    def test_checkout_requires_documented_simulation_contract(self):
        self.upstream.request.side_effect = [self.order, {"mode": "simulation", "reference": "reference_hoy"}]
        self.assertEqual(self.post("orders/order_hoy/checkout/", **self.headers).status_code, 200)
        self.upstream.request.side_effect = [self.order, {"mode": "live"}]
        self.assertEqual(self.post("orders/order_hoy/checkout/", **self.headers).status_code, 503)

    def test_simulation_ignores_browser_reference_and_rereads_confirmed_order(self):
        paid = {**self.order, "status": "paid"}
        self.upstream.staff_authorization.return_value = "Bearer existing-local-session"
        self.upstream.request.side_effect = [self.order, {"accepted": True}, paid]
        response = self.post("orders/order_hoy/simulate/", {"reference": "another_orders_reference"}, **self.headers)
        self.assertEqual(response.json()["status"], "paid")
        self.assertEqual(self.upstream.request.call_args_list[1].kwargs["body"], {"reference": "reference_hoy"})
        self.assertEqual(self.upstream.request.call_args_list[-1].args[0], "/orders/order_hoy")

    def test_simulation_replay_on_paid_order_is_read_only(self):
        self.upstream.request.return_value = {**self.order, "status": "paid"}
        self.assertEqual(self.post("orders/order_hoy/simulate/", **self.headers).json()["status"], "paid")
        self.assertEqual(self.upstream.request.call_count, 1)

    def test_expired_and_unstarted_orders_cannot_simulate(self):
        for order in [{**self.order, "status": "expired"}, {**self.order, "provider_reference": None}]:
            self.upstream.request.return_value = order
            self.upstream.request.reset_mock()
            self.assertEqual(self.post("orders/order_hoy/simulate/", **self.headers).status_code, 409)
            self.assertEqual(self.upstream.request.call_count, 1)

    def test_unpaid_wrong_and_revoked_tickets_have_no_qr(self):
        for status, ticket_status, ticket_id in [
            ("held", "valid", "ticket_hoy"),
            ("paid", "revoked", "ticket_hoy"),
            ("paid", "valid", "other"),
        ]:
            self.upstream.request.return_value = {
                **self.order,
                "status": status,
                "tickets": [{"id": "ticket_hoy", "status": ticket_status}],
            }
            self.upstream.request.reset_mock()
            response = self.client.get(self.prefix + f"orders/order_hoy/tickets/{ticket_id}/qr.svg", **self.headers)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(self.upstream.request.call_count, 1)

    def test_paid_qr_is_upstream_svg_with_no_store(self):
        self.upstream.request.side_effect = [
            {**self.order, "status": "paid", "tickets": [{"id": "ticket_hoy", "status": "valid", "token": "upstream-only"}]},
            b'<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        ]
        response = self.client.get(self.prefix + "orders/order_hoy/tickets/ticket_hoy/qr.svg", **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/svg+xml")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertNotIn(b"upstream-only", response.content)

    def test_csrf_is_required_for_local_order_writes(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.post(self.prefix + "orders/", {}, content_type="application/json").status_code, 403)
        client.get(f"/tickets/{self.event.slug}/")
        token = client.cookies["csrftoken"].value
        self.upstream.request.return_value = self.order
        response = client.post(
            self.prefix + "orders/",
            {"email": "buyer@example.test", "items": []},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
            HTTP_IDEMPOTENCY_KEY="csrf-protected-key",
        )
        self.assertEqual(response.status_code, 201)

    def test_get_does_not_trigger_checkout_and_post_does_not_read_private_qr(self):
        self.assertEqual(self.client.get(self.prefix + "orders/order_hoy/checkout/", **self.headers).status_code, 405)
        self.assertEqual(self.post("orders/order_hoy/tickets/ticket_hoy/qr.svg", **self.headers).status_code, 405)
        self.upstream.request.assert_not_called()

    def test_cancelled_and_past_events_cannot_reserve(self):
        for status, starts_at in [
            (Event.Status.CANCELLED, self.event.starts_at),
            (Event.Status.PUBLISHED, timezone.now() - timedelta(days=2)),
        ]:
            self.event.status, self.event.starts_at = status, starts_at
            self.event.save()
            self.assertEqual(self.post("orders/", HTTP_IDEMPOTENCY_KEY="test-closed-event-key").status_code, 409)
        self.upstream.request.assert_not_called()

    def test_upstream_outage_does_not_assume_inventory(self):
        self.upstream.request.side_effect = CommerceError()
        response = self.client.get(self.prefix)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"code": "commerce_unavailable", "state": "unavailable"})


@override_settings(DEBUG=True, HOY_NOCHEVA_LOCAL=True)
class ProvisioningTests(HOYTestCase):
    def setUp(self):
        self.event = f.event(f.city())
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.config = Path(self.directory.name) / "fixture.json"
        self.payload = {"capacity": 20, "tiers": [{"name": "Test", "price_minor": 1500, "capacity": 20}], "terms": {"version": "TEST"}}
        self.config.write_text(json.dumps(self.payload))
        self.patch = patch("apps.ticketing.management.commands.provision_local_ticket_event.NochevaClient")
        self.upstream = self.patch.start().return_value
        self.addCleanup(self.patch.stop)
        self.upstream.organizer = "org_hoy"
        self.upstream.create_event.side_effect = lambda p: {
            "id": "commerce_hoy",
            "organizer_id": "org_hoy",
            "source_event_id": p["source_event_id"],
        }

    def provision(self):
        call_command("provision_local_ticket_event", self.event.slug, config=str(self.config), stdout=io.StringIO())

    def test_repeated_provisioning_keeps_one_source_mapping(self):
        self.provision()
        first = EventMapping.objects.get(event=self.event)
        self.provision()
        second = EventMapping.objects.get(event=self.event)
        self.assertEqual(first.source_id, second.source_id)
        self.assertEqual(first.commerce_event_id, second.commerce_event_id)
        self.assertEqual(EventMapping.objects.count(), 1)
        self.assertEqual(self.upstream.create_event.call_args_list[0], self.upstream.create_event.call_args_list[1])

    def test_lost_response_keeps_intent_for_same_source_retry(self):
        response = self.upstream.create_event.side_effect
        self.upstream.create_event.side_effect = CommerceError()
        with self.assertRaises(CommandError):
            self.provision()
        pending = EventMapping.objects.get(event=self.event)
        self.assertFalse(pending.enabled)
        self.assertTrue(pending.payload)
        self.upstream.create_event.side_effect = response
        self.provision()
        recovered = EventMapping.objects.get(event=self.event)
        self.assertEqual(pending.source_id, recovered.source_id)
        self.assertTrue(recovered.enabled)

    def test_changed_terms_fail_before_inventory_write(self):
        self.provision()
        self.upstream.create_event.reset_mock()
        self.payload["tiers"][0]["price_minor"] = 2500
        self.config.write_text(json.dumps(self.payload))
        with self.assertRaisesMessage(CommandError, "conflicts"):
            self.provision()
        self.upstream.create_event.assert_not_called()

    def test_duplicate_inventory_mapping_is_rejected(self):
        self.provision()
        other = f.event(self.event.city, title="Another event")
        with self.assertRaises(IntegrityError), transaction.atomic():
            EventMapping.objects.create(event=other, organizer_id="org_hoy", commerce_event_id="commerce_hoy")

    def test_editing_event_does_not_provision_or_change_existing_link(self):
        self.provision()
        self.upstream.create_event.reset_mock()
        self.event.title = "Renamed editorial event"
        self.event.slug = "renamed-editorial-event"
        self.event.save()
        self.upstream.create_event.assert_not_called()
        self.assertEqual(EventMapping.objects.get(event=self.event).commerce_event_id, "commerce_hoy")


@override_settings(DEBUG=True, HOY_NOCHEVA_LOCAL=True)
class LocalClientTests(SimpleTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.file = Path(self.directory.name) / "credential.env"
        self.content = "NOCHEVA_API_BASE=http://127.0.0.1:8769/api/v1/ticketing\nNOCHEVA_MODE=local_synthetic\nNOCHEVA_ORGANIZER_ID=org_hoy\nNOCHEVA_API_KEY=nva_key_test_secret\n"
        self.file.write_text(self.content)
        self.file.chmod(0o600)
        self.override = override_settings(HOY_NOCHEVA_CREDENTIAL_FILE=str(self.file))
        self.override.enable()
        self.addCleanup(self.override.disable)

    def test_external_or_authenticated_origins_are_refused(self):
        for base in [
            "https://payments.example.com",
            "http://127.0.0.1:8769@evil.test/api/v1/ticketing",
            "http://127.0.0.1:8769/api/v1/ticketing?x=1",
        ]:
            self.file.write_text(self.content.replace("http://127.0.0.1:8769/api/v1/ticketing", base))
            with self.assertRaises(CommerceError):
                NochevaClient()

    def test_publicly_readable_credentials_are_refused(self):
        self.file.chmod(0o644)
        with self.assertRaises(CommerceError):
            NochevaClient()

    def test_symlink_credentials_are_refused(self):
        link = self.file.with_name("link.env")
        link.symlink_to(self.file)
        with override_settings(HOY_NOCHEVA_CREDENTIAL_FILE=str(link)), self.assertRaises(CommerceError):
            NochevaClient()

    def test_health_rejects_real_provider_before_order_write(self):
        client = NochevaClient()
        client._http = Mock(return_value={"simulation": False, "money_collection": True, "provider": "RealProvider"})
        with self.assertRaises(CommerceError):
            client.request("/events/test/orders", method="POST", body={})
        client._http.assert_called_once_with("/health")

    def test_redirects_are_refused_without_forwarding_credentials(self):
        with self.assertRaises(CommerceError):
            NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://outside.example")
