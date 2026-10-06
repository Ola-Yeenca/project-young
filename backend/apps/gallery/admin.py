from django import forms
from django.contrib import admin
from django.utils.html import format_html

from apps.core.models import MediaKind

from .models import Album, AlbumItem


class MultipleImageInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultipleImageField(forms.ImageField):
    widget = MultipleImageInput

    def clean(self, data, initial=None):
        single = super().clean
        if isinstance(data, (list, tuple)):
            return [single(item, initial) for item in data if item]
        return [single(data, initial)] if data else []


class AlbumAdminForm(forms.ModelForm):
    upload = MultipleImageField(
        required=False,
        label="Add photos",
        help_text="Select as many photos as you like. They are added to the end of the album.",
    )

    class Meta:
        model = Album
        fields = "__all__"


class AlbumItemInline(admin.TabularInline):
    model = AlbumItem
    extra = 0
    fields = ("preview", "kind", "image", "video_url", "caption", "order")
    readonly_fields = ("preview",)

    @admin.display(description="")
    def preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="width:64px;height:64px;object-fit:cover;border-radius:6px">', obj.image.url)
        return "▶" if obj.kind == MediaKind.VIDEO else "—"


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    form = AlbumAdminForm
    list_display = ("title", "city", "event", "date", "item_count", "is_published", "order")
    list_editable = ("is_published", "order")
    list_filter = ("city", "is_published")
    search_fields = ("title", "event__title")
    prepopulated_fields = {"slug": ("title",)}
    autocomplete_fields = ("event",)
    inlines = [AlbumItemInline]
    fields = ("title", "slug", "city", "event", "date", "cover", "is_published", "order", "upload")

    @admin.display(description="Items")
    def item_count(self, obj):
        return obj.items.count()

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        files = form.cleaned_data.get("upload") or []
        start = (form.instance.items.order_by("-order").values_list("order", flat=True).first() or 0) + 1
        for offset, image in enumerate(files):
            AlbumItem.objects.create(album=form.instance, kind=MediaKind.PHOTO, image=image, order=start + offset)
        if files:
            self.message_user(request, f"Added {len(files)} photo(s) to {form.instance}.")
