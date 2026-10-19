from django.contrib import admin

from .models import Track


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "genre", "city", "is_published", "created_at")
    list_filter = ("genre", "city", "is_published")
    search_fields = ("title", "artist")
