# admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser

class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name')
    list_filter = ('email_is_verified',)
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('first_name',)

# Register CustomUser using the custom admin class
admin.site.register(CustomUser, CustomUserAdmin)
