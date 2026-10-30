from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone

from apps.core.models import City, MusicStyle, normalize_catalog_name
from apps.events.admin import EventAdminForm
from apps.events.models import Event
from apps.studio.forms import (
    EventForm,
    MusicStyleForm,
    QuickCityForm,
    QuickVenueForm,
    TalentForm,
    VenueFormSet,
    music_style_choices,
    music_style_names,
)
from apps.talent.admin import TalentAdminForm

from . import factories as f
from .base import HOYTestCase


class MusicStyleCatalogTests(HOYTestCase):
    def test_names_are_normalized_and_case_or_space_duplicates_are_rejected(self):
        style = MusicStyle.objects.create(name="  Afro\u00a0House  ")
        self.assertEqual((style.name, style.slug, style.normalized_name), ("Afro House", "afro-house", "afro house"))
        with self.assertRaises(ValidationError):
            MusicStyle.objects.create(name="afro   house")

        form = MusicStyleForm(data={"name": "AFRO HOUSE"})
        self.assertFalse(form.is_valid())
        self.assertIn("already exists", form.errors["name"][0])

    def test_slug_stays_stable_when_the_label_is_renamed(self):
        style = MusicStyle.objects.create(name="Afro House")
        style.name = "Afrohouse"
        style.save()
        self.assertEqual((style.slug, style.normalized_name), ("afro-house", "afrohouse"))

    def test_unicode_expansion_cannot_overflow_the_stored_normalized_key(self):
        with self.assertRaises(ValidationError) as error:
            MusicStyle.objects.create(name="ﬃ" * 41)
        self.assertIn("120 characters or fewer", str(error.exception))

    def test_choice_accessors_merge_builtins_catalog_and_legacy_current_value(self):
        MusicStyle.objects.create(name="Techno")
        choices = dict(music_style_choices("legacy-style"))
        self.assertEqual(choices["afrobeats"], "Afrobeats")
        self.assertEqual(choices["techno"], "Techno")
        self.assertEqual(choices["legacy-style"], "legacy-style")
        self.assertIn("Techno", music_style_names())


class QuickCatalogFormTests(HOYTestCase):
    def test_quick_city_is_inactive_and_normalized_duplicates_are_blocked(self):
        form = QuickCityForm(data={"name": "Porto", "country": "Portugal", "currency": "EUR", "timezone": "Europe/Lisbon"})
        self.assertTrue(form.is_valid(), form.errors)
        city = form.save()
        self.assertEqual((city.slug, city.is_active, city.order), ("porto", False, 1))

        duplicate = QuickCityForm(data={"name": "  PORTO ", "country": "Portugal", "currency": "EUR", "timezone": "Europe/Lisbon"})
        self.assertFalse(duplicate.is_valid())
        self.assertIn("already exists", duplicate.errors["name"][0])

    def test_quick_venue_derives_slug_and_scopes_normalized_duplicates_to_city(self):
        valencia = f.city()
        lagos = f.city("Lagos")
        form = QuickVenueForm(data={"city": valencia.pk, "name": "La Marina", "address": "Port", "map_url": "", "capacity": 500})
        self.assertTrue(form.is_valid(), form.errors)
        venue = form.save()
        self.assertEqual((venue.slug, venue.city), ("la-marina", valencia))

        duplicate = QuickVenueForm(
            data={"city": valencia.pk, "name": "  LA   MARINA ", "address": "Elsewhere", "map_url": "", "capacity": 300}
        )
        self.assertFalse(duplicate.is_valid())
        self.assertIn("already has a venue", duplicate.errors["name"][0])
        other_city = QuickVenueForm(data={"city": lagos.pk, "name": "La Marina", "address": "Lagos", "map_url": "", "capacity": 300})
        self.assertTrue(other_city.is_valid(), other_city.errors)

    def test_new_city_inline_venues_reject_normalized_duplicates_before_save(self):
        formset = VenueFormSet(
            data={
                "venues-TOTAL_FORMS": "2",
                "venues-INITIAL_FORMS": "0",
                "venues-MIN_NUM_FORMS": "0",
                "venues-MAX_NUM_FORMS": "1000",
                "venues-0-name": "Warehouse",
                "venues-0-address": "One",
                "venues-0-map_url": "",
                "venues-0-capacity": "100",
                "venues-1-name": "  WAREHOUSE ",
                "venues-1-address": "Two",
                "venues-1-map_url": "",
                "venues-1-capacity": "200",
            },
            instance=City(name="New City", slug="new-city", country="Spain", currency="EUR", timezone="Europe/Madrid"),
        )
        self.assertFalse(formset.is_valid())
        self.assertTrue(all("name" in form.errors for form in formset.forms))

    def test_new_city_inline_venues_reject_distinct_names_with_the_same_derived_slug(self):
        formset = VenueFormSet(
            data={
                "venues-TOTAL_FORMS": "2",
                "venues-INITIAL_FORMS": "0",
                "venues-MIN_NUM_FORMS": "0",
                "venues-MAX_NUM_FORMS": "1000",
                "venues-0-name": "La Marina",
                "venues-0-address": "One",
                "venues-0-map_url": "",
                "venues-0-capacity": "100",
                "venues-1-name": "La-Marina",
                "venues-1-address": "Two",
                "venues-1-map_url": "",
                "venues-1-capacity": "200",
            },
            instance=City(name="New City", slug="new-city", country="Spain", currency="EUR", timezone="Europe/Madrid"),
        )
        self.assertFalse(formset.is_valid())
        self.assertTrue(all(any("needs its own web address" in error for error in form.errors["name"]) for form in formset.forms))


class MusicStyleFormIntegrationTests(HOYTestCase):
    def test_event_forms_accept_catalog_styles_and_preserve_a_legacy_value(self):
        style = MusicStyle.objects.create(name="Afro House")
        city = f.city()
        venue = f.venue(city)
        data = {
            "title": "Sunday Session",
            "slug": "sunday-session",
            "city": city.pk,
            "venue": venue.pk,
            "kind": Event.Kind.CLUB,
            "starts_at": (timezone.now() + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M"),
            "status": Event.Status.DRAFT,
            "music_style": style.slug,
            "featured_order": 0,
            "age_restriction": "18+",
        }
        form = EventForm(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.save().music_style, "afro-house")

        legacy = f.event(city, venue, title="Legacy", status=Event.Status.DRAFT, music_style="future-jazz")
        admin_form = EventAdminForm(instance=legacy)
        self.assertIn(("future-jazz", "future-jazz"), list(admin_form.fields["music_style"].choices))

    def test_talent_form_keeps_genre_free_text_and_exposes_the_datalist(self):
        city = f.city()
        form = TalentForm(
            data={
                "name": "DJ Ada",
                "slug": "dj-ada",
                "city": city.pk,
                "category": "dj",
                "genre": "Afro House / Techno",
                "bio": "Resident DJ.",
                "booking_available": "on",
                "travels": "on",
                "featured_order": 0,
            },
            files={"photo": f.image_file()},
        )
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.save().genre, "Afro House / Techno")
        self.assertEqual(form.fields["genre"].widget.attrs["list"], "music-style-options")

    def test_talent_admin_genre_input_links_catalog_datalist_and_accepts_free_text(self):
        MusicStyle.objects.create(name="Techno")
        city = f.city()
        form = TalentAdminForm(
            data={
                "name": "DJ Nia",
                "slug": "dj-nia",
                "city": city.pk,
                "category": "dj",
                "genre": "Afro House / Techno",
                "bio": "Resident DJ.",
                "booking_available": "on",
                "travels": "on",
                "featured_order": 0,
            },
            files={"photo": f.image_file()},
        )
        self.assertTrue(form.is_valid(), form.errors)
        rendered = str(form["genre"])
        self.assertIn('list="music-style-options"', rendered)
        self.assertIn('<datalist id="music-style-options">', rendered)
        self.assertIn('<option value="Techno"></option>', rendered)
        self.assertEqual(form.save().genre, "Afro House / Techno")


class MusicStyleMigrationTests(TransactionTestCase):
    migrate_from = [
        ("core", "0002_more_currencies"),
        ("events", "0002_event_poster_alt_event_poster_fit_alter_event_poster"),
    ]
    migrate_to = [
        ("core", "0003_musicstyle"),
        ("events", "0003_alter_event_music_style"),
    ]

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        old_apps = executor.loader.project_state(self.migrate_from).apps
        CityModel = old_apps.get_model("core", "City")
        VenueModel = old_apps.get_model("core", "Venue")
        EventModel = old_apps.get_model("events", "Event")
        TalentModel = old_apps.get_model("talent", "Talent")
        city = CityModel.objects.create(name="Valencia", slug="valencia", country="Spain", currency="EUR", timezone="Europe/Madrid")
        venue = VenueModel.objects.create(city=city, name="Club", slug="club")
        EventModel.objects.create(
            title="Legacy",
            slug="legacy",
            city=city,
            venue=venue,
            starts_at=timezone.now(),
            music_style="Afro House",
        )
        TalentModel.objects.create(
            name="DJ Legacy",
            slug="dj-legacy",
            city=city,
            category="dj",
            genre="Afro House / Techno",
            bio="Legacy bio",
            photo="",
        )
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        self.apps = executor.loader.project_state(self.migrate_to).apps

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()

    def test_data_migration_seeds_builtins_and_preserves_complete_legacy_values(self):
        MusicStyleModel = self.apps.get_model("core", "MusicStyle")
        names = set(MusicStyleModel.objects.values_list("name", flat=True))
        self.assertTrue({"Afrobeats", "Amapiano", "Highlife", "Mixed", "Afro House", "Afro House / Techno"} <= names)
        normalized_names = list(MusicStyleModel.objects.values_list("normalized_name", flat=True))
        self.assertEqual(len(normalized_names), len(set(normalized_names)))
        self.assertIn(normalize_catalog_name("Afro House / Techno"), normalized_names)
