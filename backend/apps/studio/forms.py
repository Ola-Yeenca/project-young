from django import forms
from django.forms import BaseInlineFormSet, inlineformset_factory, modelformset_factory
from django.utils.text import slugify

from apps.core.image_validation import validate_managed_image
from apps.core.models import FAQ, City, MusicStyle, SiteSettings, Venue, normalize_catalog_name
from apps.enquiries.models import EnquiryBase
from apps.events.models import Event
from apps.events.timezones import from_city_wall_time, to_city_wall_time
from apps.gallery.models import Album, AlbumItem
from apps.shop.models import Product, ProductPrice, ProductVariant
from apps.talent.models import Talent

DT_FORMAT = "%Y-%m-%dT%H:%M"


def music_style_choices(current=None):
    """Catalog choices with built-ins available even after a test database flush."""

    choices = dict(Event.Style.choices)
    choices.update(MusicStyle.objects.values_list("slug", "name"))
    if current and current not in choices:
        choices[current] = current
    return list(choices.items())


def music_style_names():
    """Display names for free-text genre suggestion lists."""

    names = [label for _, label in Event.Style.choices]
    names.extend(MusicStyle.objects.values_list("name", flat=True))
    result = []
    seen = set()
    for name in names:
        key = normalize_catalog_name(name)
        if key and key not in seen:
            seen.add(key)
            result.append(name)
    return result


class LocalDateTimeInput(forms.DateTimeInput):
    input_type = "datetime-local"

    def __init__(self, **kwargs):
        super().__init__(format=DT_FORMAT, **kwargs)


class StyledMixin:
    """Adds the Studio input class to every widget so templates can render fields plainly."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            widget = field.widget
            if isinstance(widget, (forms.CheckboxInput, forms.CheckboxSelectMultiple)):
                continue
            if isinstance(widget, forms.ClearableFileInput):
                widget.attrs.setdefault("class", "file")
                widget.attrs.setdefault("accept", ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp")
                continue
            widget.attrs.setdefault("class", "in")
            if isinstance(widget, forms.Textarea):
                widget.attrs.setdefault("rows", 4)


class EventForm(StyledMixin, forms.ModelForm):
    TIME_FIELDS = ("starts_at", "ends_at")
    music_style = forms.ChoiceField(choices=(), label="Music style")

    class Meta:
        model = Event
        fields = (
            "title",
            "slug",
            "city",
            "venue",
            "kind",
            "starts_at",
            "ends_at",
            "status",
            "poster",
            "poster_alt",
            "poster_fit",
            "caption",
            "description",
            "lineup",
            "lineup_extra",
            "music_style",
            "bpm",
            "ticket_url",
            "ticket_provider",
            "price_from",
            "sold_out",
            "sold_percent",
            "age_restriction",
            "is_featured",
            "featured_order",
        )
        widgets = {
            "starts_at": LocalDateTimeInput(),
            "ends_at": LocalDateTimeInput(),
            "lineup": forms.CheckboxSelectMultiple,
            "description": forms.Textarea(attrs={"rows": 5}),
            "poster_alt": forms.TextInput(attrs={"placeholder": "Example: Gold event poster with the date and venue"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        current_style = self.instance.music_style if self.instance.pk else self.initial.get("music_style")
        self.fields["music_style"].choices = music_style_choices(current_style)
        for name in self.TIME_FIELDS:
            self.fields[name].input_formats = [DT_FORMAT, "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"]
            if self.instance.pk and self.instance.city_id and getattr(self.instance, name):
                self.initial[name] = to_city_wall_time(getattr(self.instance, name), self.instance.city)
        self.fields["venue"].queryset = self.fields["venue"].queryset.select_related("city")
        self.fields["lineup"].queryset = Talent.objects.select_related("city").order_by("city__order", "name")
        self.fields["slug"].help_text = "Web address. Filled in from the title."
        self.fields["poster_fit"].required = False

    def clean(self):
        cleaned = super().clean()
        cleaned["poster_fit"] = cleaned.get("poster_fit") or Event.PosterFit.CONTAIN
        self.instance.poster_fit = cleaned["poster_fit"]
        city = cleaned.get("city")
        for name in self.TIME_FIELDS:
            if cleaned.get(name) is not None:
                cleaned[name] = from_city_wall_time(cleaned[name], city)
                setattr(self.instance, name, cleaned[name])
        return cleaned


class TalentForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = Talent
        fields = (
            "name",
            "slug",
            "city",
            "category",
            "genre",
            "photo",
            "bio",
            "previous_work",
            "booking_available",
            "travels",
            "spotify_url",
            "apple_music_url",
            "soundcloud_url",
            "youtube_url",
            "instagram_url",
            "tiktok_url",
            "website_url",
            "is_published",
            "is_featured",
            "featured_order",
        )
        widgets = {"bio": forms.Textarea(attrs={"rows": 4}), "previous_work": forms.Textarea(attrs={"rows": 4})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["genre"].widget.attrs.update({"list": "music-style-options", "autocomplete": "off"})


class MusicStyleForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = MusicStyle
        fields = ("name",)


class MultiImageInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultiImageField(forms.ImageField):
    widget = MultiImageInput

    def clean(self, data, initial=None):
        single = super().clean
        if isinstance(data, (list, tuple)):
            return [single(item, initial) for item in data if item]
        return [single(data, initial)] if data else []


class UploadForm(forms.Form):
    photos = MultiImageField(required=False, validators=[validate_managed_image])
    video_url = forms.URLField(
        required=False, widget=forms.URLInput(attrs={"class": "in", "placeholder": "Paste a YouTube, Instagram or TikTok link"})
    )
    caption = forms.CharField(
        required=False, max_length=200, widget=forms.TextInput(attrs={"class": "in", "placeholder": "Caption (optional)"})
    )

    def clean(self):
        cleaned = super().clean()
        if not cleaned.get("photos") and not cleaned.get("video_url"):
            raise forms.ValidationError("Choose some photos or paste a video link.")
        return cleaned


class AlbumForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = Album
        fields = ("title", "slug", "city", "event", "date", "cover", "is_published", "order")
        widgets = {"date": forms.DateInput(attrs={"type": "date"})}


class AlbumItemForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = AlbumItem
        fields = ("image", "alt", "caption", "order", "is_published")
        widgets = {"alt": forms.TextInput(attrs={"placeholder": "Describe this image"})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            self.fields["image"].widget.attrs["data-preview"] = f"#album-item-preview-{self.instance.pk}"


class ProductForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = Product
        fields = ("name", "slug", "image", "description", "material", "fit", "is_published", "order")
        widgets = {"description": forms.Textarea(attrs={"rows": 3})}


class PriceForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = ProductPrice
        fields = ("city", "amount", "checkout_url", "is_available")


class VariantForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = ProductVariant
        fields = ("label", "sku", "stock", "order")


PriceFormSet = inlineformset_factory(Product, ProductPrice, form=PriceForm, extra=1, can_delete=True)
VariantFormSet = inlineformset_factory(Product, ProductVariant, form=VariantForm, extra=1, can_delete=True)


class FAQForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = FAQ
        fields = ("question", "answer", "category", "order", "is_published")
        widgets = {"answer": forms.Textarea(attrs={"rows": 2})}


FAQFormSet = modelformset_factory(FAQ, form=FAQForm, extra=1, can_delete=True)


class SiteSettingsForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = SiteSettings
        fields = ("tagline", "about", "contact_email", "booking_email", "instagram_url", "tiktok_url", "youtube_url", "show_powered_by")
        widgets = {"about": forms.Textarea(attrs={"rows": 6})}


class EnquiryUpdateForm(forms.Form):
    status = forms.ChoiceField(choices=EnquiryBase.Status.choices, required=False)
    internal_notes = forms.CharField(required=False, widget=forms.Textarea(attrs={"rows": 4, "class": "in"}))
    assign = forms.CharField(required=False)  # "me", "none" or a user id


# Country presets used to pre-fill the city form. Only facts the form can't get
# wrong: currency and the main time zone. Ticket partners are pre-filled only for
# the two markets HOY already works in.
COUNTRY_PRESETS = {
    "Spain": {"currency": "EUR", "timezone": "Europe/Madrid", "provider": "Fourvenues"},
    "Nigeria": {"currency": "NGN", "timezone": "Africa/Lagos", "provider": "Tix.africa"},
    "Ghana": {"currency": "GHS", "timezone": "Africa/Accra"},
    "United Kingdom": {"currency": "GBP", "timezone": "Europe/London"},
    "Ireland": {"currency": "EUR", "timezone": "Europe/Dublin"},
    "Portugal": {"currency": "EUR", "timezone": "Europe/Lisbon"},
    "France": {"currency": "EUR", "timezone": "Europe/Paris"},
    "Germany": {"currency": "EUR", "timezone": "Europe/Berlin"},
    "Netherlands": {"currency": "EUR", "timezone": "Europe/Amsterdam"},
    "Belgium": {"currency": "EUR", "timezone": "Europe/Brussels"},
    "Italy": {"currency": "EUR", "timezone": "Europe/Rome"},
    "Kenya": {"currency": "KES", "timezone": "Africa/Nairobi"},
    "South Africa": {"currency": "ZAR", "timezone": "Africa/Johannesburg"},
    "Senegal": {"currency": "XOF", "timezone": "Africa/Dakar"},
    "Côte d'Ivoire": {"currency": "XOF", "timezone": "Africa/Abidjan"},
    "Morocco": {"currency": "MAD", "timezone": "Africa/Casablanca"},
    "Egypt": {"currency": "EGP", "timezone": "Africa/Cairo"},
    "United Arab Emirates": {"currency": "AED", "timezone": "Asia/Dubai"},
    "United States": {"currency": "USD", "timezone": "America/New_York"},
    "Canada": {"currency": "CAD", "timezone": "America/Toronto"},
}


class CityForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = City
        fields = (
            "name",
            "slug",
            "country",
            "currency",
            "timezone",
            "ticket_provider",
            "whatsapp_number",
            "instagram_url",
            "is_active",
            "order",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "country" in self.fields:
            self.fields["country"].widget.attrs.update({"list": "country-list", "autocomplete": "off"})
        if "timezone" in self.fields:
            self.fields["timezone"].widget.attrs.update({"list": "tz-list", "autocomplete": "off", "placeholder": "Africa/Accra"})
            self.fields["timezone"].label = "Time zone"
        if "whatsapp_number" in self.fields:
            self.fields["whatsapp_number"].widget.attrs["placeholder"] = "+233 20 000 0000"
            self.fields["whatsapp_number"].label = "WhatsApp number"
        if "is_active" in self.fields:
            self.fields["is_active"].label = "Show this city on the site"
            self.fields["is_active"].help_text = "Leave off while you set it up. It appears in Studio either way."
        if "slug" in self.fields:
            self.fields["slug"].required = False
        if "ticket_provider" in self.fields:
            self.fields["ticket_provider"].label = "Ticket partner"
        if "instagram_url" in self.fields:
            self.fields["instagram_url"].label = "Instagram"
        if "order" in self.fields:
            self.fields["order"].label = "Position in lists"

    def clean_name(self):
        name = " ".join(self.cleaned_data["name"].split())
        key = normalize_catalog_name(name)
        if self.instance.pk and normalize_catalog_name(self.instance.name) == key:
            return self.instance.name
        cities = City.objects.exclude(pk=self.instance.pk).only("name")
        if any(normalize_catalog_name(city.name) == key for city in cities):
            raise forms.ValidationError("A city with this name already exists.")
        return name

    def clean_slug(self):
        return self.cleaned_data.get("slug") or slugify(self.cleaned_data.get("name", ""))

    def clean(self):
        cleaned = super().clean()
        name = cleaned.get("name")
        if not name:
            return cleaned
        proposed_slug = cleaned.get("slug") or slugify(name)[:80]
        if not proposed_slug:
            self.add_error("name", "Enter a city name that can form a web address.")
            return cleaned
        duplicate = City.objects.exclude(pk=self.instance.pk).filter(slug=proposed_slug).exists()
        if duplicate:
            self.add_error("name", "Another city already uses this web address.")
        elif "slug" in self.fields:
            cleaned["slug"] = proposed_slug
        return cleaned

    def save(self, commit=True):
        city = super().save(commit=False)
        if not city.slug:
            city.slug = slugify(city.name)[:80]
        if commit:
            city.save()
        return city


class QuickCityForm(CityForm):
    class Meta(CityForm.Meta):
        fields = ("name", "country", "currency", "timezone")

    def save(self, commit=True):
        city = super().save(commit=False)
        if not city.pk:
            city.is_active = False
            city.order = City.objects.count() + 1
            city.ticket_provider = COUNTRY_PRESETS.get(city.country, {}).get("provider", "")
        if commit:
            city.save()
        return city


class VenueForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = Venue
        fields = ("name", "address", "map_url", "capacity")
        widgets = {"address": forms.TextInput()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["map_url"].widget.attrs["placeholder"] = "Google Maps link"
        self.fields["capacity"].widget.attrs["placeholder"] = "e.g. 600"

    def _city_id(self):
        city = self.cleaned_data.get("city")
        return city.pk if city else self.instance.city_id

    def clean_name(self):
        name = " ".join(self.cleaned_data["name"].split())
        key = normalize_catalog_name(name)
        if self.instance.pk and normalize_catalog_name(self.instance.name) == key:
            return self.instance.name
        city_id = self._city_id()
        if city_id:
            venues = Venue.objects.filter(city_id=city_id).exclude(pk=self.instance.pk).only("name")
            if any(normalize_catalog_name(venue.name) == key for venue in venues):
                raise forms.ValidationError("This city already has a venue with this name.")
        return name

    def clean(self):
        cleaned = super().clean()
        name = cleaned.get("name")
        city_id = self._city_id()
        if not name or not city_id:
            return cleaned
        proposed_slug = self.instance.slug or slugify(name)[:120]
        if not proposed_slug:
            self.add_error("name", "Enter a venue name that can form a web address.")
        elif Venue.objects.filter(city_id=city_id, slug=proposed_slug).exclude(pk=self.instance.pk).exists():
            self.add_error("name", "Another venue in this city already uses this web address.")
        return cleaned

    def save(self, commit=True):
        venue = super().save(commit=False)
        if not venue.slug:
            venue.slug = slugify(venue.name)
        if commit:
            venue.save()
        return venue


class QuickVenueForm(VenueForm):
    class Meta(VenueForm.Meta):
        fields = ("city", "name", "address", "map_url", "capacity")


class BaseVenueFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        seen_names = {}
        seen_slugs = {}
        for form in self.forms:
            if not hasattr(form, "cleaned_data") or form.cleaned_data.get("DELETE"):
                continue
            name = form.cleaned_data.get("name")
            if not name:
                continue
            name_key = normalize_catalog_name(name)
            slug_key = form.instance.slug or slugify(name)[:120]
            if name_key in seen_names:
                message = "Venue names must be unique within a city."
                form.add_error("name", message)
                seen_names[name_key].add_error("name", message)
            else:
                seen_names[name_key] = form
            if not slug_key:
                form.add_error("name", "Enter a venue name that can form a web address.")
            elif slug_key in seen_slugs:
                message = "Venue web addresses must be unique within a city."
                form.add_error("name", message)
                seen_slugs[slug_key].add_error("name", message)
            else:
                seen_slugs[slug_key] = form


VenueFormSet = inlineformset_factory(City, Venue, form=VenueForm, formset=BaseVenueFormSet, extra=2, can_delete=True)
