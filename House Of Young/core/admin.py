from django.contrib import admin
from .models import BlogPost, Event, Webgel, Organizer, Collaborator, Sponsor

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'start_date', 'is_published')
    search_fields = ('title', 'content', 'home_page__title')
    prepopulated_fields = {'slug': ('title',)}


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
