# custom_user/models.py
from django_use_email_as_username.models import BaseUser, BaseUserManager
from django.db import models

class AdminUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        email = self.normalize_email(email)
        user = self.model(email=email,**extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')

        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class AdminUser(BaseUser):
    objects = AdminUserManager()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Admin User"
        verbose_name_plural = "Admins"
        permissions = [
            ('can_add_admin_user', 'Can add admin user'),
            ('can_change_admin_user', 'Can change admin user'),
            ('can_delete_admin_user', 'Can delete admin user'),
        ]

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='admin_user_groups',
        related_query_name='admin_user_group',
        blank=True,
        verbose_name='Groups',
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
    )


class OrganizerProfile(models.Model):
    user = models.OneToOneField(AdminUser, on_delete=models.CASCADE)


    def __str__(self):
        return f"Organizer Profile - {self.user.username}"



class CollaboratorProfile(models.Model):
    user = models.OneToOneField(AdminUser, on_delete=models.CASCADE)
    organizer = models.ForeignKey(OrganizerProfile, on_delete=models.SET, null=True, blank=True)
    @property
    def get_organizer(self):
        return self.organizer


    def __str__(self):
        return f"Collaborator Profile - {self.user.username}"
