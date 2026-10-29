"""The downloadable copy of a gallery photo: resized, credited on the image and in its EXIF."""

from io import BytesIO

from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont, ImageOps

from .models import AlbumItem

LONG_EDGE = 2400
ARTIST, COPYRIGHT, DESCRIPTION = 315, 33432, 270


def caption_of(item: AlbumItem, sep: str = " · ") -> str:
    album = item.album
    title = album.event.title if album.event else album.title
    when = album.date or (album.event.starts_at.date() if album.event else None)
    parts = [title] + ([] if album.city.name.lower() in title.lower() else [album.city.name])
    if when:
        parts.append(f"{when.day} {when:%b %Y}")
    return sep.join(parts)


def stamped(item: AlbumItem) -> bytes:
    with item.image.open("rb") as f:
        img = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
    img.thumbnail((LONG_EDGE, LONG_EDGE))
    w, h = img.size
    unit = max(12, round(min(w, h) / 48))

    band = Image.new("L", (1, 256))
    band.putdata([round(170 * (y / 255) ** 2) for y in range(256)])
    shade = Image.new("RGB", (w, unit * 7), (0, 0, 0))
    img.paste(shade, (0, h - unit * 7), band.resize((w, unit * 7)))

    draw = ImageDraw.Draw(img)
    big, small = ImageFont.load_default(size=unit * 1.15), ImageFont.load_default(size=unit * 0.8)
    x, y = unit * 1.4, h - unit * 1.4
    draw.text((x, y), caption_of(item).upper(), font=small, fill=(216, 178, 90), anchor="ls")
    draw.text((x, y - unit * 1.3), "HOUSE OF YOUNG", font=big, fill=(242, 240, 234), anchor="ls")

    exif = Image.Exif()
    exif[ARTIST] = "House of Young"
    # EXIF text is ASCII only.
    exif[COPYRIGHT] = f"(c) {timezone.localdate().year} House of Young. Personal use; credit House of Young when sharing."
    exif[DESCRIPTION] = caption_of(item, " - ").encode("ascii", "replace").decode()
    out = BytesIO()
    img.save(out, "JPEG", quality=88, optimize=True, exif=exif)
    return out.getvalue()
