from django.contrib import admin

from .models import BookingEnquiry, ContactEnquiry, EnquiryBase


def status_action(status, label):
    @admin.action(description=f"Mark selected as {label}")
    def action(modeladmin, request, queryset):
        updated = queryset.update(status=status)
        modeladmin.message_user(request, f"Marked {updated} as {label}.")

    action.__name__ = f"mark_{status}"
    return action


ACTIONS = [status_action(s, label) for s, label in EnquiryBase.Status.choices if s in {"in_progress", "won", "lost", "closed", "spam"}]


class EnquiryAdminMixin:
    list_editable = ("status", "assigned_to")
    list_filter = ("status", "city", "created_at")
    date_hierarchy = "created_at"
    actions = ACTIONS
    readonly_fields = ("reference", "created_at", "updated_at", "privacy_accepted")

    @admin.display(description="Received", ordering="created_at")
    def received(self, obj):
        return obj.created_at.strftime("%d %b, %H:%M")


@admin.register(BookingEnquiry)
class BookingEnquiryAdmin(EnquiryAdminMixin, admin.ModelAdmin):
    list_display = (
        "reference",
        "client_name",
        "talent",
        "event_date",
        "event_location",
        "expected_audience",
        "received",
        "status",
        "assigned_to",
    )
    list_filter = ("status", "talent", "event_type", "city", "created_at")
    search_fields = ("client_name", "company", "email", "phone", "event_location", "message", "talent__name")
    autocomplete_fields = ("talent",)
    fieldsets = (
        ("Handling", {"fields": ("reference", "status", "assigned_to", "internal_notes")}),
        ("Client", {"fields": ("client_name", "company", "email", "phone")}),
        ("Booking", {"fields": ("talent", "city", "event_date", "event_location", "event_type", "expected_audience", "message")}),
        ("Record", {"fields": ("privacy_accepted", "created_at", "updated_at")}),
    )


@admin.register(ContactEnquiry)
class ContactEnquiryAdmin(EnquiryAdminMixin, admin.ModelAdmin):
    list_display = ("reference", "name", "category", "subject", "received", "status", "assigned_to")
    list_filter = ("status", "category", "city", "created_at")
    search_fields = ("name", "email", "phone", "subject", "message")
    fieldsets = (
        ("Handling", {"fields": ("reference", "status", "assigned_to", "internal_notes")}),
        ("From", {"fields": ("name", "email", "phone", "city")}),
        ("Message", {"fields": ("category", "subject", "message")}),
        ("Record", {"fields": ("privacy_accepted", "created_at", "updated_at")}),
    )
