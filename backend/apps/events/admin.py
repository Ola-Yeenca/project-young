from django import forms
from django.contrib import admin, messages
from django.utils.html import format_html

from .models import Event
from .timezones import from_city_wall_time, to_city_wall_time


class EventAdminForm(forms.ModelForm):
    TIME_FIELDS = ("starts_at", "ends_at")

    class Meta:
        model = Event
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and self.instance.city_id:
            for name in self.TIME_FIELDS:
                value = getattr(self.instance, name)
                if value is not None:
                    self.initial[name] = to_city_wall_time(value, self.instance.city)
        for name in self.TIME_FIELDS:
            if name in self.fields:
                self.fields[name].help_text = "Local time in the event's city."

    def clean(self):
        cleaned = super().clean()
        city = cleaned.get("city")
        for name in self.TIME_FIELDS:
            if cleaned.get(name) is not None:
                cleaned[name] = from_city_wall_time(cleaned[name], city)
                setattr(self.instance, name, cleaned[name])
        return cleaned


@admin.action(description="Publish selected events")
def publish(modeladmin, request, queryset):
    published, skipped = 0, []
    for event in queryset:
        event.status = Event.Status.PUBLISHED
        try:
            event.full_clean()
        except Exception:  # noqa: BLE001 - reported to the user below
            skipped.append(event.title)
            continue
        event.save(update_fields=["status", "updated_at"])
        published += 1
    if published:
        messages.success(request, f"Published {published} event(s).")
    if skipped:
        messages.warning(request, "Not published, missing a ticket link or price: " + ", ".join(skipped))


@admin.action(description="Move selected events back to draft")
def unpublish(modeladmin, request, queryset):
    queryset.update(status=Event.Status.DRAFT)


@admin.action(description="Feature on the homepage")
def feature(modeladmin, request, queryset):
    queryset.update(is_featured=True)


@admin.action(description="Remove from the homepage")
def unfeature(modeladmin, request, queryset):
    queryset.update(is_featured=False)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    form = EventAdminForm
    list_display = ("poster_thumb", "title", "city", "local_start", "venue", "status", "is_featured", "featured_order")
    list_display_links = ("poster_thumb", "title")
    list_editable = ("status", "is_featured", "featured_order")
    list_filter = ("city", "status", "is_featured", "kind")
    search_fields = ("title", "venue__name", "lineup__name", "lineup_extra")
    date_hierarchy = "starts_at"
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("venue", "lineup")
    actions = [publish, unpublish, feature, unfeature]
    list_select_related = ("city", "venue")
    fieldsets = (
        ("Event", {"fields": ("title", "slug", "city", "venue", "kind", "starts_at", "ends_at", "status")}),
        ("Artwork and copy", {"fields": ("poster", "caption", "description")}),
        ("Line-up and sound", {"fields": ("lineup", "lineup_extra", "music_style", "bpm")}),
        ("Tickets", {"fields": ("ticket_url", "ticket_provider", "price_from", "sold_out", "sold_percent", "age_restriction")}),
        ("Homepage", {"fields": ("is_featured", "featured_order")}),
    )

    @admin.display(description="", ordering=None)
    def poster_thumb(self, obj):
        if obj.poster:
            return format_html('<img src="{}" style="width:44px;height:44px;object-fit:cover;border-radius:6px">', obj.poster.url)
        return "—"

    @admin.display(description="Starts (local)", ordering="starts_at")
    def local_start(self, obj):
        return obj.local_starts_at.strftime("%a %d %b %Y, %H:%M")
