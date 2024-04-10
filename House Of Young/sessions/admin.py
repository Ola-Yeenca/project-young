from datetime import timezone
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from custom_user.models import CustomUser, UserProfile

class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'

class CustomUserAdmin(UserAdmin):
    model = CustomUser
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('username', 'first_name', 'last_name')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'first_name', 'last_name', 'password1', 'password2'),
        }),
    )
    list_display = ('email', 'username', 'first_name', 'last_name', 'is_staff')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('email',)

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if obj is None:  # This is for the add form
            form.base_fields.pop('date_joined', None)
            form.base_fields.pop('last_login', None)
        return form

    def save_model(self, request, obj, form, change):
        if not obj.pk:  # Only set date_joined on initial save
            obj.date_joined = timezone.now()
        obj.save()

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(UserProfile)

