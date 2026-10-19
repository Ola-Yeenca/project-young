from django.contrib import admin

from .models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "city", "channel", "instagram", "created_at", "unsubscribed_at")
    list_filter = ("city", "channel", "events", "talent", "business", "merch", "unsubscribed_at")
    search_fields = ("name", "email", "phone", "instagram")
    readonly_fields = ("consent_at", "created_at", "updated_at")
