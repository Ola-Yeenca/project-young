"""Django settings for the House of Young backend.

Everything environment-specific comes from environment variables, so the same
code runs locally, in CI and in production. See ../.env.example for the list.
"""

import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


def env(name, default=None):
    return os.environ.get(name, default)


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)

SECRET_KEY = env("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off.")
    SECRET_KEY = "dev-only-insecure-key"

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1" if DEBUG else "")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")
# The public website runs on its own domain and calls the read-only API and the enquiry forms.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173" if DEBUG else "")
CORS_URLS_REGEX = r"^/api/.*$"

# Railway sets RAILWAY_PUBLIC_DOMAIN for every service and runs its health check
# from healthcheck.railway.app, so trust both without extra configuration.
RAILWAY_PUBLIC_DOMAIN = env("RAILWAY_PUBLIC_DOMAIN")
if RAILWAY_PUBLIC_DOMAIN:
    ALLOWED_HOSTS += [RAILWAY_PUBLIC_DOMAIN, "healthcheck.railway.app"]
# Every real domain we serve is also a trusted origin for Studio's forms.
for _host in ALLOWED_HOSTS:
    if "." in _host and not _host.startswith(".") and _host not in {"127.0.0.1", "healthcheck.railway.app"}:
        _origin = f"https://{_host}"
        if _origin not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(_origin)

INSTALLED_APPS = [
    "jazzmin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "apps.core",
    "apps.events",
    "apps.talent",
    "apps.gallery",
    "apps.shop",
    "apps.enquiries",
    "apps.studio",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "apps.studio.context.studio",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Postgres in production via DATABASE_URL; SQLite for local work and tests.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-gb"
# The HOY team works from Valencia. Event times are entered in each event's own
# city time zone (see apps.events.admin.EventAdminForm), so this only affects
# timestamps such as "enquiry received at" in the admin.
TIME_ZONE = env("DJANGO_TIME_ZONE", "Europe/Madrid")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
MEDIA_URL = env("DJANGO_MEDIA_URL", "/media/")
MEDIA_ROOT = BASE_DIR / "media"

# Uploaded media goes to S3-compatible object storage (Cloudflare R2 or AWS S3)
# when a bucket is configured; otherwise it stays on local disk for development.
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
if AWS_STORAGE_BUCKET_NAME:
    _default_storage = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": AWS_STORAGE_BUCKET_NAME,
            "endpoint_url": env("AWS_S3_ENDPOINT_URL"),
            "region_name": env("AWS_S3_REGION_NAME", "auto"),
            "custom_domain": env("AWS_S3_CUSTOM_DOMAIN"),
            "default_acl": None,
            "querystring_auth": False,
            "file_overwrite": False,
            "object_parameters": {"CacheControl": "public, max-age=31536000, immutable"},
        },
    }
else:
    _default_storage = {"BACKEND": "django.core.files.storage.FileSystemStorage"}

STORAGES = {
    "default": _default_storage,
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
        if not DEBUG
        else "django.contrib.staticfiles.storage.StaticFilesStorage"
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGIN_URL = "studio:login"
DATA_UPLOAD_MAX_NUMBER_FILES = 200
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# Email: console output while developing, SMTP (Resend, Postmark, ...) in production.
EMAIL_BACKEND = env(
    "DJANGO_EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = env("EMAIL_HOST", "localhost")
EMAIL_PORT = int(env("EMAIL_PORT", "587"))
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "House of Young <hello@houseofyoung.example>")
SERVER_EMAIL = DEFAULT_FROM_EMAIL
# Where enquiries go when Site settings in the admin has no address yet.
HOY_TEAM_EMAIL = env("HOY_TEAM_EMAIL", "team@houseofyoung.example")

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_RATES": {"enquiries": env("HOY_ENQUIRY_RATE", "10/hour")},
    "UNAUTHENTICATED_USER": None,
}

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    # The host's health check calls over plain HTTP inside its network.
    SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]
    SECURE_HSTS_SECONDS = int(env("DJANGO_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env("DJANGO_LOG_LEVEL", "INFO")},
}

JAZZMIN_SETTINGS = {
    "site_title": "HOY admin",
    "site_header": "House of Young",
    "site_brand": "House of Young",
    "welcome_sign": "House of Young admin",
    "copyright": "House of Young · powered by SME Analytica",
    "search_model": ["events.Event", "talent.Talent", "enquiries.BookingEnquiry"],
    "topmenu_links": [
        {"name": "Enquiries", "url": "admin:app_list", "args": ["enquiries"]},
        {"name": "Events", "url": "admin:events_event_changelist"},
        {"name": "Talent", "url": "admin:talent_talent_changelist"},
    ],
    "order_with_respect_to": ["enquiries", "events", "talent", "gallery", "shop", "core", "auth"],
    "icons": {
        "auth.user": "fas fa-user",
        "auth.group": "fas fa-users",
        "core.city": "fas fa-city",
        "core.venue": "fas fa-map-marker-alt",
        "core.faq": "fas fa-question-circle",
        "core.sitesettings": "fas fa-sliders-h",
        "events.event": "fas fa-calendar-alt",
        "talent.talent": "fas fa-microphone",
        "gallery.album": "fas fa-images",
        "shop.product": "fas fa-tshirt",
        "enquiries.bookingenquiry": "fas fa-handshake",
        "enquiries.contactenquiry": "fas fa-envelope",
    },
    "changeform_format": "horizontal_tabs",
    "related_modal_active": True,
    "show_ui_builder": False,
    "custom_css": "hoy/admin.css",
}
JAZZMIN_UI_TWEAKS = {
    "navbar": "navbar-dark",
    "sidebar": "sidebar-dark-warning",
    "brand_colour": "navbar-dark",
    "accent": "accent-warning",
    "button_classes": {"primary": "btn-warning"},
}
