import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.events.models import Event
from apps.ticketing.client import CommerceError, NochevaClient
from apps.ticketing.models import EventMapping


class Command(BaseCommand):
    help = "Explicitly provision one published HOY event in loopback synthetic Nocheva; retries preserve identity."

    def add_arguments(self, parser):
        parser.add_argument("slug")
        parser.add_argument("--config", required=True, help="JSON containing capacity, tiers and allocation terms.")

    def handle(self, *args, **options):
        try:
            client = NochevaClient()
            event = Event.objects.published().select_related("city").get(slug=options["slug"])
            if event.status == Event.Status.CANCELLED or event.starts_at <= timezone.now():
                raise CommandError("Only an upcoming published event can be provisioned.")
            config = json.loads(Path(options["config"]).read_text())
            if not isinstance(config, dict) or set(config) != {"capacity", "tiers", "terms"}:
                raise CommandError("Fixture config must contain capacity, tiers and terms only.")
            country = {"Spain": "ES", "Nigeria": "NG"}.get(event.city.country)
            if (country, event.city.currency) not in {("ES", "EUR"), ("NG", "NGN")}:
                raise CommandError("Unsupported event country/currency.")
            mapping, _ = EventMapping.objects.get_or_create(event=event, defaults={"organizer_id": client.organizer})
            if mapping.organizer_id != client.organizer:
                raise CommandError("Refusing to change an existing mapping's organizer.")
            payload = {
                **config,
                "title": f"TEST / HOY / {event.title}",
                "country": country,
                "currency": event.city.currency,
                "starts_at": event.starts_at.isoformat(),
                "source_event_id": f"hoy:{mapping.source_id}",
            }
            if mapping.payload and mapping.payload != payload:
                raise CommandError("Fixture conflicts with the stored provisioning intent; no inventory changed.")
            if not mapping.payload:
                mapping.payload = payload
                mapping.save(update_fields=["payload"])
            created = client.create_event(payload)
            if (
                created.get("organizer_id") != mapping.organizer_id
                or created.get("source_event_id") != payload["source_event_id"]
                or (mapping.commerce_event_id and mapping.commerce_event_id != created.get("id"))
            ):
                raise CommandError("Nocheva returned an inconsistent mapping; link remains unchanged.")
            mapping.commerce_event_id = created["id"]
            mapping.enabled = True
            mapping.save(update_fields=["commerce_event_id", "enabled"])
            self.stdout.write(self.style.SUCCESS(f"Local simulation linked: {event.slug} -> {mapping.commerce_event_id}"))
        except Event.DoesNotExist as exc:
            raise CommandError("Published event not found.") from exc
        except CommerceError as exc:
            raise CommandError(f"Local Nocheva refused setup: {exc.code}") from exc
        except (OSError, ValueError, KeyError) as exc:
            raise CommandError("Invalid or unreadable fixture config/response.") from exc
