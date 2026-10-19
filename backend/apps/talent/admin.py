from django import forms
from django.contrib import admin
from django.utils.html import format_html, format_html_join

from apps.studio.forms import music_style_names

from .models import Talent, TalentMedia


class MusicStyleDatalistInput(forms.TextInput):
    def render(self, name, value, attrs=None, renderer=None):
        text_input = super().render(name, value, attrs, renderer)
        options = format_html_join("", '<option value="{}"></option>', ((style,) for style in music_style_names()))
        return format_html('{}<datalist id="music-style-options">{}</datalist>', text_input, options)


class TalentAdminForm(forms.ModelForm):
    class Meta:
        model = Talent
        fields = "__all__"
        widgets = {"genre": MusicStyleDatalistInput(attrs={"list": "music-style-options", "autocomplete": "off"})}


class TalentMediaInline(admin.TabularInline):
    model = TalentMedia
    extra = 1
    fields = ("kind", "image", "video_url", "caption", "order")


@admin.register(Talent)
class TalentAdmin(admin.ModelAdmin):
    form = TalentAdminForm
    list_display = ("photo_thumb", "name", "category", "city", "booking_available", "is_published", "is_featured", "featured_order")
    list_display_links = ("photo_thumb", "name")
    list_editable = ("booking_available", "is_published", "is_featured", "featured_order")
    list_filter = ("city", "category", "is_published", "is_featured", "booking_available")
    search_fields = ("name", "genre", "bio")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [TalentMediaInline]
    fieldsets = (
        ("Profile", {"fields": ("name", "slug", "city", "category", "genre", "photo", "bio", "previous_work")}),
        ("Bookings", {"fields": ("booking_available", "travels")}),
        (
            "Links",
            {"fields": ("spotify_url", "apple_music_url", "soundcloud_url", "youtube_url", "instagram_url", "tiktok_url", "website_url")},
        ),
        ("Visibility", {"fields": ("is_published", "is_featured", "featured_order")}),
    )

    @admin.display(description="")
    def photo_thumb(self, obj):
        if obj.photo:
            return format_html('<img src="{}" style="width:44px;height:44px;object-fit:cover;border-radius:50%">', obj.photo.url)
        return "—"
