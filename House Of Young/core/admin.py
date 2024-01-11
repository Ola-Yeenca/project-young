from django.contrib import admin
from .models import HomePage, BlogPost, Contact, About, Event, Webgel

@admin.register(HomePage)
class HomePageAdmin(admin.ModelAdmin):
    list_display = ('title', 'event_date', 'is_active')
    search_fields = ('title', 'content')

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_at', 'is_published')
    search_fields = ('title', 'content', 'home_page__title')
    prepopulated_fields = {'slug': ('title',)}

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'subject', 'created_at', 'is_active')
    search_fields = ('name', 'email', 'subject', 'message')

@admin.register(About)
class AboutAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_at', 'is_published_about')
    search_fields = ('title', 'content')

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'event_date', 'is_published_event')
    search_fields = ('title', 'content', 'home_page__title')


@admin.register(Webgel)
class WebgelAdmin(admin.ModelAdmin):
    list_display = ('id', 'type', 'color')
    search_fields = ('title', 'content')
