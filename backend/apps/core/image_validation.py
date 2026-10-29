"""Validation shared by user-managed image uploads."""

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_managed_image(value):
    """Accept a small, fully decodable JPEG, PNG or WebP and rewind it."""

    if getattr(value, "size", 0) > MAX_IMAGE_BYTES:
        raise ValidationError("Images must be 10 MiB or smaller.", code="image_too_large")

    opened_here = False
    try:
        if hasattr(value, "open") and getattr(value, "closed", False):
            value.open("rb")
            opened_here = True
        value.seek(0)
        with Image.open(value) as image:
            image_format = image.format
            width, height = image.size
            if image_format not in ALLOWED_IMAGE_FORMATS:
                raise ValidationError("Upload a JPEG, PNG or WebP image.", code="unsupported_image_format")
            if width * height > MAX_IMAGE_PIXELS:
                raise ValidationError("Images must be 40 megapixels or smaller.", code="image_dimensions_too_large")
            image.verify()

        value.seek(0)
        with Image.open(value) as image:
            image.load()
    except ValidationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValidationError("Images must be 40 megapixels or smaller.", code="image_dimensions_too_large") from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ValidationError("Upload a valid JPEG, PNG or WebP image.", code="invalid_image") from exc
    finally:
        try:
            value.seek(0)
        except (AttributeError, OSError, ValueError):
            pass
        if opened_here:
            value.close()
