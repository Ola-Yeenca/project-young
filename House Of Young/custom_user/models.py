from django_use_email_as_username.models import BaseUser, BaseUserManager
from django.db import models
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import EmailValidator

class AdminUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if email is None:
            raise ValueError('The Email field must be set and valid')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
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
    email = models.EmailField(unique=True)
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

    def __str__(self):
        return self.email


class CustomUserManager(BaseUserManager):
    def create_user(self, email, username, password=None, **extra_fields):
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    @classmethod
    def create_user_profile(cls, email, username, password=None, **extra_fields):
        user = cls.create_user(email, username, password, **extra_fields)
        UserProfile.objects.create(user=user)
        return user

    def save_user_profile(self, user, **extra_fields):
        user.save(using=self._db)
        UserProfile.objects.create(user=user, **extra_fields)
        return user


class CustomUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(max_length=254, unique=True, validators=[EmailValidator()])
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30, default='')
    username = models.CharField(max_length=150, unique=True)
    email_is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name']

    objects = CustomUserManager()

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='%(app_label)s_%(class)s_groups',
        related_query_name='custom_user_group',
        blank=True,
        verbose_name='Groups',
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
    )

    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='%(app_label)s_%(class)s_permissions',
        related_query_name='custom_user_permission',
        blank=True,
        verbose_name='User permissions',
        help_text='Specific permissions for this user.',
    )

    def __str__(self):
        return self.username

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"

    def get_short_name(self):
        return self.first_name


class UserProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    phone_number = models.CharField(max_length=15, blank=True, default='')
    bio = models.TextField(max_length=500, blank=True, default='')
    location = models.CharField(max_length=30, blank=True, default='')
    birth_date = models.DateField(null=True, blank=True)
    avatar = models.ImageField(default='default.jpg', upload_to='profile_images', blank=True, null=True)


    def __str__(self):
        return self.user.get_username() if self.user else "Deleted User"
