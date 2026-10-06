from pathlib import Path
from tempfile import TemporaryDirectory

from django.http import Http404
from django.test import RequestFactory, SimpleTestCase, override_settings

from apps.core.public import preview


class ConnectedPreviewTests(SimpleTestCase):
    def test_preview_loads_adapter_without_modifying_original(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "prototype").mkdir()
            source = root / "prototype" / "index.html"
            original = "<html>Reviewed prototype</html>"
            source.write_text(original)
            with override_settings(DEBUG=True, BASE_DIR=root / "backend"):
                response = preview(RequestFactory().get("/preview/"))
            self.assertEqual(response.status_code, 200)
            self.assertIn(b"/static/hoy/live-content.js", response.content)
            self.assertIn(b"/static/hoy/live-content.css", response.content)
            self.assertEqual(response["Cache-Control"], "no-store")
            self.assertEqual(source.read_text(), original)

    @override_settings(DEBUG=False)
    def test_preview_is_unavailable_in_production(self):
        with self.assertRaises(Http404):
            preview(RequestFactory().get("/preview/"))

    def test_missing_prototype_is_a_404(self):
        with TemporaryDirectory() as directory:
            with override_settings(DEBUG=True, BASE_DIR=Path(directory) / "backend"):
                with self.assertRaises(Http404):
                    preview(RequestFactory().get("/preview/"))
