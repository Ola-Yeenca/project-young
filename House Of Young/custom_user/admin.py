from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import AdminUser, UserProfile


class CustomUserAdmin(UserAdmin):
    ordering = ('created_at',)


admin.site.register(AdminUser, CustomUserAdmin)
