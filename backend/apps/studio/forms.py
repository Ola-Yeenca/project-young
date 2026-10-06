from django import forms
from django.forms import inlineformset_factory, modelformset_factory
from django.utils.text import slugify

from apps.core.models import FAQ, City, SiteSettings, Venue
from apps.enquiries.models import EnquiryBase
from apps.events.models import Event
from apps.events.timezones import from_city_wall_time, to_city_wall_time
from apps.gallery.models import Album
from apps.shop.models import Product, ProductPrice, ProductVariant
from apps.talent.models import Talent

DT_FORMAT = "%Y-%m-%dT%H:%M"


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
                widget.attrs.setdefault("accept", "image/*")
                continue
            widget.attrs.setdefault("class", "in")
            if isinstance(widget, forms.Textarea):
                widget.attrs.setdefault("rows", 4)


class EventForm(StyledMixin, forms.ModelForm):
    TIME_FIELDS = ("starts_at", "ends_at")

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
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in self.TIME_FIELDS:
            self.fields[name].input_formats = [DT_FORMAT, "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"]
            if self.instance.pk and self.instance.city_id and getattr(self.instance, name):
                self.initial[name] = to_city_wall_time(getattr(self.instance, name), self.instance.city)
        self.fields["venue"].queryset = self.fields["venue"].queryset.select_related("city")
        self.fields["lineup"].queryset = Talent.objects.select_related("city").order_by("city__order", "name")
        self.fields["slug"].help_text = "Web address. Filled in from the title."

    def clean(self):
        cleaned = super().clean()
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
    photos = MultiImageField(required=False)
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
        fields = ("title", "slug", "city", "event", "date", "cover", "is_published")
        widgets = {"date": forms.DateInput(attrs={"type": "date"})}


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
        self.fields["country"].widget.attrs.update({"list": "country-list", "autocomplete": "off"})
        self.fields["timezone"].widget.attrs.update({"list": "tz-list", "autocomplete": "off", "placeholder": "Africa/Accra"})
        self.fields["whatsapp_number"].widget.attrs["placeholder"] = "+233 20 000 0000"
        self.fields["is_active"].label = "Show this city on the site"
        self.fields["is_active"].help_text = "Leave off while you set it up. It appears in Studio either way."
        self.fields["slug"].required = False
        self.fields["timezone"].label = "Time zone"
        self.fields["ticket_provider"].label = "Ticket partner"
        self.fields["whatsapp_number"].label = "WhatsApp number"
        self.fields["instagram_url"].label = "Instagram"
        self.fields["order"].label = "Position in lists"

    def clean_slug(self):
        return self.cleaned_data.get("slug") or slugify(self.cleaned_data.get("name", ""))


class VenueForm(StyledMixin, forms.ModelForm):
    class Meta:
        model = Venue
        fields = ("name", "address", "map_url", "capacity")
        widgets = {"address": forms.TextInput()}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["map_url"].widget.attrs["placeholder"] = "Google Maps link"
        self.fields["capacity"].widget.attrs["placeholder"] = "e.g. 600"

    def save(self, commit=True):
        venue = super().save(commit=False)
        if not venue.slug:
            venue.slug = slugify(venue.name)
        if commit:
            venue.save()
        return venue


VenueFormSet = inlineformset_factory(City, Venue, form=VenueForm, extra=2, can_delete=True)
