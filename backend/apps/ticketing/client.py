"""Fail-closed loopback adapter, deliberately limited to synthetic commerce."""

import json
import re
import stat
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from django.conf import settings

MAX_RESPONSE = 2 * 1024 * 1024
IDENTIFIER = re.compile(r"[A-Za-z0-9_.:-]{1,200}\Z")


class CommerceError(Exception):
    def __init__(self, code="commerce_unavailable", status=503):
        self.code = code
        self.status = status
        super().__init__(code)


def local_enabled():
    return settings.DEBUG and settings.HOY_NOCHEVA_LOCAL


def identifier(value):
    if not isinstance(value, str) or not IDENTIFIER.fullmatch(value):
        raise CommerceError("invalid_request", 422)
    return value


def private_file(path):
    file = Path(path)
    info = file.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_size > 65536:
        raise CommerceError()
    return file.read_text(encoding="utf-8")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise CommerceError()


class NochevaClient:
    def __init__(self):
        if not local_enabled():
            raise CommerceError("event_not_available", 404)
        try:
            fields = dict(
                line.split("=", 1)
                for line in private_file(settings.HOY_NOCHEVA_CREDENTIAL_FILE).splitlines()
                if line and not line.startswith("#")
            )
            self.base = fields["NOCHEVA_API_BASE"].rstrip("/")
            parsed = urlsplit(self.base)
            if (
                parsed.scheme != "http"
                or parsed.hostname != "127.0.0.1"
                or parsed.port != 8769
                or parsed.path != "/api/v1/ticketing"
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
                or fields["NOCHEVA_MODE"] != "local_synthetic"
            ):
                raise CommerceError()
            self.organizer = identifier(fields["NOCHEVA_ORGANIZER_ID"])
            self.key = fields["NOCHEVA_API_KEY"]
            if not self.key.startswith("nva_key_") or any(c.isspace() for c in self.key):
                raise CommerceError()
        except (OSError, KeyError, ValueError, TypeError) as exc:
            raise CommerceError() from exc
        self.opener = build_opener(ProxyHandler({}), NoRedirect())
        self.checked = False

    def _http(self, path, *, method="GET", body=None, headers=None, svg=False):
        if not path.startswith("/") or "?" in path or "#" in path or ".." in path:
            raise CommerceError("invalid_request", 422)
        request_headers = {"Accept": "image/svg+xml" if svg else "application/json", **(headers or {})}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            request_headers["Content-Type"] = "application/json"
        # __init__ restricts the complete origin to http://127.0.0.1:8769; redirects are refused.
        request = Request(self.base + path, data=data, headers=request_headers, method=method)  # noqa: S310
        try:
            with self.opener.open(request, timeout=8) as response:
                raw = response.read(MAX_RESPONSE + 1)
                if len(raw) > MAX_RESPONSE:
                    raise CommerceError()
                if svg:
                    if response.headers.get_content_type() != "image/svg+xml":
                        raise CommerceError()
                    return raw
                return json.loads(raw)
        except HTTPError as exc:
            try:
                error = json.loads(exc.read(65536))
                code = error.get("code", "commerce_unavailable")
                if not isinstance(code, str) or not re.fullmatch(r"[a-z_]{1,80}", code):
                    code = "commerce_unavailable"
            except (ValueError, AttributeError):
                code = "commerce_unavailable"
            raise CommerceError(code, exc.code if 400 <= exc.code < 500 else 503) from exc
        except (URLError, TimeoutError, OSError, ValueError) as exc:
            raise CommerceError() from exc

    def request(self, path, **kwargs):
        if not self.checked:
            health = self._http("/health")
            if (
                not isinstance(health, dict)
                or health.get("simulation") is not True
                or health.get("money_collection") is not False
                or health.get("provider") != "SyntheticProvider"
            ):
                raise CommerceError("synthetic_provider_required", 503)
            self.checked = True
        return self._http(path, **kwargs)

    def create_event(self, payload):
        return self.request(
            f"/organizers/{self.organizer}/events",
            method="POST",
            body=payload,
            headers={"Authorization": f"Bearer {self.key}"},
        )

    def staff_authorization(self):
        try:
            value = json.loads(private_file(settings.HOY_NOCHEVA_STAFF_FILE))["authorization"]
            if not isinstance(value, str) or not value.startswith("Bearer nva_session_") or "\n" in value or "\r" in value:
                raise CommerceError("local_staff_session_required", 503)
            return value
        except (OSError, KeyError, ValueError, TypeError) as exc:
            raise CommerceError("local_staff_session_required", 503) from exc
