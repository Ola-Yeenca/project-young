from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from custom_user.models import CustomUser

class CustomUserAdmin(admin.ModelAdmin):
    model = CustomUser
    list_display = ['username', 'email', 'first_name', 'last_name', 'is_active']
    ordering = ['username']


admin.site.register(CustomUser, CustomUserAdmin)
