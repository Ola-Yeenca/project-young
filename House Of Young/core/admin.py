from django.contrib import admin
from .models import BlogPost, Event, Webgel, Organizer, Collaborator, Sponsor, Homepage, Venue



@admin.register(Homepage)
class HomepageAdmin(admin.ModelAdmin):
    list_display = ('is_active',)
    search_fields = ('content',)

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'venue', 'event_date', 'is_published')
    search_fields = ('title', 'content', 'home_page__title', 'venue__name')
    prepopulated_fields = {'slug': ('title',)}

@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ('address', 'city', 'country')
    search_fields = ('address', 'city', 'country')

@admin.register(Organizer)
class OrganizerAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(Collaborator)
class CollaboratorAdmin(admin.ModelAdmin):
    list_display = ('user', 'organizer', 'event')
    search_fields = ('user', 'organizer', 'event')


@admin.register(Sponsor)
class SponsorAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_at', 'is_published')
    search_fields = ('title', 'content', 'home_page__title')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(Webgel)
class WebgelAdmin(admin.ModelAdmin):
    list_display = ('id', 'type', 'color')
    search_fields = ('id', 'type', 'color')
