# admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser

class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'full_name')
    list_filter = ('email_is_verified', 'is_active')
    search_fields = ('username', 'email', 'full_name')
    ordering = ('full_name',)

# Register CustomUser using the custom admin class
admin.site.register(CustomUser, CustomUserAdmin)
