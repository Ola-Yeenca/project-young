import unicodedata

from django.db import migrations, models
from django.utils.text import slugify

BUILT_IN_STYLES = (
    ("afrobeats", "Afrobeats"),
    ("amapiano", "Amapiano"),
    ("highlife", "Highlife"),
    ("mixed", "Mixed"),
)


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value or "").split()).casefold()


def display_name(value):
    return " ".join(unicodedata.normalize("NFKC", value or "").split())


def seed_music_styles(apps, schema_editor):
    MusicStyle = apps.get_model("core", "MusicStyle")
    Event = apps.get_model("events", "Event")
    Talent = apps.get_model("talent", "Talent")
    database = schema_editor.connection.alias

    values = list(BUILT_IN_STYLES)
    values.extend((None, value) for value in Event.objects.using(database).order_by("pk").values_list("music_style", flat=True))
    values.extend((None, value) for value in Talent.objects.using(database).order_by("pk").values_list("genre", flat=True))

    used_names = set(MusicStyle.objects.using(database).values_list("normalized_name", flat=True))
    used_slugs = set(MusicStyle.objects.using(database).values_list("slug", flat=True))
    for preferred_slug, raw_name in values:
        name = display_name(raw_name)
        key = normalized(name)
        if not key or key in used_names:
            continue
        if len(name) > 120 or len(key) > 120:
            raise RuntimeError("A legacy music style exceeds 120 characters after Unicode normalization.")
        base = (preferred_slug or slugify(name) or "style")[:120]
        candidate = base
        suffix = 2
        while candidate in used_slugs:
            marker = f"-{suffix}"
            candidate = f"{base[: 120 - len(marker)]}{marker}"
            suffix += 1
        MusicStyle.objects.using(database).create(name=name, slug=candidate, normalized_name=key)
        used_names.add(key)
        used_slugs.add(candidate)


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_more_currencies"),
        ("events", "0002_event_poster_alt_event_poster_fit_alter_event_poster"),
        ("talent", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="MusicStyle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("normalized_name", models.CharField(editable=False, max_length=120, unique=True)),
            ],
            options={"ordering": ("name",)},
        ),
        migrations.RunPython(seed_music_styles, migrations.RunPython.noop),
    ]
