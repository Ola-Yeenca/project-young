from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from custom_user.models import CustomUser, UserProfile

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'

class CustomUserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'is_staff')
    list_filter = ('is_staff', 'is_superuser', 'is_active')
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Permissions', {'fields': ('is_staff', 'is_superuser', 'is_active')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2', 'is_staff', 'is_superuser', 'is_active')}
            ),
    )
    search_fields = ('email', 'username')
    ordering = ('email',)

class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone_number', 'bio', 'location', 'birth_date', 'avatar', 'verified')
    search_fields = ('user__username', 'user__email')

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(UserProfile, UserProfileAdmin)
