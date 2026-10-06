from django.contrib import admin

from .models import FAQ, City, SiteSettings, Venue


class VenueInline(admin.TabularInline):
    model = Venue
    extra = 0
    prepopulated_fields = {"slug": ("name",)}
    fields = ("name", "slug", "address", "map_url", "capacity")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "currency", "timezone", "ticket_provider", "is_active", "order")
    list_editable = ("is_active", "order")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [VenueInline]


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "capacity")
    list_filter = ("city",)
    search_fields = ("name", "address")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ("question", "category", "order", "is_published")
    list_editable = ("order", "is_published")
    list_filter = ("category", "is_published")
    search_fields = ("question", "answer")


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ("Content", {"fields": ("tagline", "about")}),
        ("Where enquiries go", {"fields": ("contact_email", "booking_email")}),
        ("Social", {"fields": ("instagram_url", "tiktok_url", "youtube_url")}),
        ("Footer", {"fields": ("show_powered_by",)}),
    )

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
