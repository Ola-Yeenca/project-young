import json
import tempfile
from pathlib import Path

from django.test import SimpleTestCase
from whitenoise.storage import CompressedManifestStaticFilesStorage


class StaticManifestTests(SimpleTestCase):
    """The production static storage, which the other tests swap for plain StaticFilesStorage."""

    def storage(self, root):
        Path(root, "staticfiles.json").write_text(json.dumps({"paths": {}, "version": "1.1", "hash": ""}))
        return CompressedManifestStaticFilesStorage(location=root, base_url="/static/")

    def test_folder_without_a_manifest_entry_gets_its_plain_url(self):
        # django-jazzmin's admin/base.html does {% static 'vendor/bootswatch' %} on every admin page.
        with tempfile.TemporaryDirectory() as root:
            Path(root, "vendor/bootswatch/default").mkdir(parents=True)
            self.assertEqual(self.storage(root).url("vendor/bootswatch"), "/static/vendor/bootswatch")

    def test_missing_file_still_raises(self):
        with tempfile.TemporaryDirectory() as root, self.assertRaises(ValueError):
            self.storage(root).url("nope/missing.css")
