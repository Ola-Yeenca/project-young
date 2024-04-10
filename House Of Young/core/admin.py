from django.contrib import admin
from .models import BlogPost, Event

def approve_events(modeladmin, request, queryset):
    queryset.update(is_published=True)

class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'event_date', 'tickets_available', 'is_published')
    list_filter = ('is_published', 'event_date')
    search_fields = ('title', 'description')
    actions = [approve_events]



admin.site.register(Event, EventAdmin)
admin.site.register(BlogPost)
