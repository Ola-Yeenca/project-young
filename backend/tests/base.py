import shutil
import tempfile

from django.test import TestCase, override_settings

_MEDIA = tempfile.mkdtemp(prefix="hoy-test-media-")


@override_settings(
    MEDIA_ROOT=_MEDIA,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    },
)
class HOYTestCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(_MEDIA, ignore_errors=True)
