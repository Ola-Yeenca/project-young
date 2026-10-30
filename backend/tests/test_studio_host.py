import os
import runpy
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client, SimpleTestCase, override_settings
from django.urls import reverse

from .base import HOYTestCase

User = get_user_model()
STUDIO = "studio.fromthehouseofyoung.com"
API = "api.fromthehouseofyoung.com"


@override_settings(HOY_STUDIO_HOST=STUDIO, ALLOWED_HOSTS=[API, STUDIO])
class StudioHostTests(HOYTestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", verbosity=0)
        cls.boss = User.objects.create_superuser("boss", "boss@hoy.example", "a-long-password-1")

    def setUp(self):
        self.studio = Client(HTTP_HOST=STUDIO)
        self.api = Client(HTTP_HOST=API)

    def test_studio_and_admin_answer_at_the_root(self):
        r = self.studio.get("/")
        self.assertEqual((r.status_code, r["Location"]), (302, "/login/?next=/"))
        self.assertContains(self.studio.get("/login/"), "Sign in to Studio")
        self.assertEqual(self.studio.get("/admin/login/").status_code, 200)
        self.studio.force_login(self.boss)
        for path in ("/", "/events/", "/enquiries/", "/crowd/", "/content/", "/cities/", "/admin/", "/admin/auth/user/"):
            self.assertEqual(self.studio.get(path).status_code, 200, path)
        html = self.studio.get("/events/").content.decode()
        self.assertIn('href="/content/"', html)
        self.assertIn('href="/admin/"', html)
        self.assertIn('href="/scope/lagos/?next=/events/"', html)
        self.assertNotIn('"/studio/', html)

    def test_studio_host_serves_nothing_public(self):
        for path in ("/api/v1/health/", "/api/v1/events/", "/api/v1/enquiries/contact/", "/tickets/afrobeats-night/"):
            self.assertEqual(self.studio.get(path).status_code, 404, path)

    def test_studio_host_stays_out_of_search_engines_and_frames(self):
        for r in (self.studio.get("/login/"), self.studio.get("/api/v1/health/")):
            self.assertEqual(r["X-Robots-Tag"], "noindex, nofollow")
            self.assertEqual(r["X-Frame-Options"], "DENY")
            self.assertEqual(r["Referrer-Policy"], "same-origin")
        robots = self.studio.get("/robots.txt")
        self.assertEqual(robots.content.decode(), "User-agent: *\nDisallow: /\n")
        self.assertEqual(robots["Content-Type"], "text/plain")

    def test_old_links_on_the_api_host_move_to_the_studio_host(self):
        moves = {
            "/studio/": "/",
            "/studio": "/",
            "/studio/content/": "/content/",
            "/studio/enquiries/?status=new&open=bk-1": "/enquiries/?status=new&open=bk-1",
            "/admin/": "/admin/",
            "/admin/auth/user/": "/admin/auth/user/",
        }
        for old, new in moves.items():
            r = self.api.get(old)
            self.assertEqual((r.status_code, r["Location"]), (301, f"https://{STUDIO}{new}"), old)
        r = self.api.post("/studio/login/", {"username": "boss"})
        self.assertEqual((r.status_code, r["Location"]), (308, f"https://{STUDIO}/login/"))

    def test_api_host_keeps_the_api(self):
        self.assertEqual(self.api.get("/api/v1/health/").status_code, 200)
        self.assertEqual(self.api.get("/api/v1/events/").status_code, 200)
        self.assertContains(self.api.get("/"), "House of Young")

    def test_old_prefix_on_the_studio_host_is_dropped(self):
        r = self.studio.get("/studio/events/?tab=drafts")
        self.assertEqual((r.status_code, r["Location"]), (301, f"https://{STUDIO}/events/?tab=drafts"))
        self.assertEqual(self.studio.get("/studio//evil.example/")["Location"], f"https://{STUDIO}/evil.example/")

    def test_sign_in_sign_out_and_lockout_on_the_studio_host(self):
        User.objects.create_user("ada", password="a-long-password-1", is_staff=True)

        def sign_in(password):
            data = {"username": "ada", "password": password, "next": "/events/"}
            return self.studio.post("/login/", data, HTTP_X_FORWARDED_FOR="81.2.3.4, 203.0.113.7")

        self.assertEqual(self.studio.get("/login/").cookies[settings.CSRF_COOKIE_NAME]["domain"], "")
        signed_in = sign_in("a-long-password-1")
        self.assertEqual((signed_in.status_code, signed_in["Location"]), (302, "/events/"))
        session = signed_in.cookies[settings.SESSION_COOKIE_NAME]
        self.assertEqual((session["domain"], session["samesite"], session["httponly"]), ("", "Lax", True))
        signed_out = self.studio.post("/logout/")
        self.assertEqual((signed_out.status_code, signed_out["Location"]), (302, "/login/"))

        for _ in range(4):
            self.assertContains(sign_in("wrong-password"), "Wrong username or password")
        locked = sign_in("wrong-password")
        self.assertContains(locked, "paused for 15 minutes", status_code=429)
        self.assertContains(locked, 'value="/events/"', status_code=429)

    def test_a_new_dj_login_points_at_the_studio_host(self):
        self.studio.force_login(self.boss)
        r = self.studio.post("/crowd/djs/", {"name": "DJ Kemi", "username": "kemi"})
        self.assertEqual(r.context["new_login"]["login_url"], f"http://{STUDIO}/login/")


@override_settings(HOY_STUDIO_HOST="")
class StudioWithoutItsOwnHostTests(HOYTestCase):
    def test_studio_and_admin_stay_on_the_main_host(self):
        self.assertEqual(reverse("studio:events"), "/studio/events/")
        login = self.client.get("/studio/login/")
        self.assertContains(login, "Sign in to Studio")
        self.assertNotIn("X-Robots-Tag", login)
        r = self.client.get("/admin/")
        self.assertEqual((r.status_code, r["Location"]), (302, "/admin/login/?next=/admin/"))
        self.assertEqual(self.client.get("/robots.txt").status_code, 404)


class StudioHostSettingsTests(SimpleTestCase):
    def test_studio_host_is_allowed_and_trusted_and_cookies_stay_host_only(self):
        env = {
            "DJANGO_DEBUG": "",
            "DJANGO_SECRET_KEY": "settings-test-only-not-a-secret-0123456789-abcdefghijkl",
            "DJANGO_ALLOWED_HOSTS": API,
            "DJANGO_CSRF_TRUSTED_ORIGINS": "",
            "HOY_STUDIO_HOST": " Studio.FromTheHouseOfYoung.com ",
            "RAILWAY_PUBLIC_DOMAIN": "",
            "RAILWAY_PRIVATE_DOMAIN": "",
            "SENTRY_DSN": "",
        }
        with mock.patch.dict(os.environ, env):
            conf = runpy.run_path(str(settings.BASE_DIR / "config" / "settings.py"))
        self.assertEqual(conf["ALLOWED_HOSTS"], [API, STUDIO])
        self.assertEqual(conf["CSRF_TRUSTED_ORIGINS"], [f"https://{API}", f"https://{STUDIO}"])
        self.assertTrue(conf["SESSION_COOKIE_SECURE"] and conf["CSRF_COOKIE_SECURE"])
        self.assertNotIn("SESSION_COOKIE_DOMAIN", conf)
        self.assertNotIn("CSRF_COOKIE_DOMAIN", conf)
