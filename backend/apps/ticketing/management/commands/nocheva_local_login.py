"""Local test sign-in to the existing organizer; never creates roles or API keys."""

import json
import os
import re
import uuid
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.ticketing.client import MAX_RESPONSE, CommerceError, NochevaClient


class Command(BaseCommand):
    help = "Renew local synthetic staff session for the existing HOY integration owner; no real email is sent."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="house-of-young-integration@example.test")

    def handle(self, *args, **options):
        try:
            client = NochevaClient()
            if not options["email"].endswith("@example.test"):
                raise CommandError("This local command accepts synthetic example.test identities only.")
            # Nocheva publishes its ephemeral reviewer capability on its loopback review page.
            # Keep it in memory; only a verified existing owner's session is persisted below.
            with client.opener.open("http://127.0.0.1:8769/review", timeout=8) as response:
                page = response.read(MAX_RESPONSE).decode()
            session = re.search(r"const session = (\{[^\n]+\});", page)
            if not session:
                raise CommandError("Local Nocheva review session is unavailable.")
            review = json.loads(session[1])["authorization"]
            key = f"hoy-local-signin:{uuid.uuid4()}"
            challenge = client.request(
                "/identity/challenges",
                method="POST",
                body={"email": options["email"]},
                headers={"Idempotency-Key": key},
            )
            inbox = client.request(
                f"/review/identity/challenges/{challenge['challenge_id']}",
                headers={"Authorization": review},
            )
            verified = client.request(
                "/identity/verify",
                method="POST",
                body={"challenge_id": challenge["challenge_id"], "code": inbox["code"]},
                headers={"Idempotency-Key": key + ":verify"},
            )
            authorization = "Bearer " + verified["access_token"]
            workspaces = client.request("/dashboard/workspaces", headers={"Authorization": authorization})
            if not any(w["id"] == client.organizer and w["role"] in {"owner", "manager"} for w in workspaces["organizers"]):
                raise CommandError("Identity does not already manage the configured organizer; no roles changed.")
            path = Path(settings.HOY_NOCHEVA_STAFF_FILE)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(path.name + f".{uuid.uuid4().hex}.tmp")
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w") as output:
                json.dump({"authorization": authorization}, output)
            os.replace(temporary, path)
            self.stdout.write(self.style.SUCCESS("Local existing-owner session renewed; no key scopes or memberships changed."))
        except CommerceError as exc:
            raise CommandError(f"Local sign-in refused: {exc.code}") from exc
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise CommandError("Local sign-in response could not be verified.") from exc
