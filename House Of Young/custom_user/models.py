from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import EmailValidator

class CustomUser(AbstractUser):
    email = models.EmailField(max_length=254, unique=True)
    username = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    email_is_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    # Choices for boolean fields
    BOOLEAN_CHOICES = [
        (True, 'Yes'),
        (False, 'No')
    ]

    def __str__(self):
        return f'{self.email} ({self.get_full_name()})'

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class UserProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    phone_number = models.CharField(max_length=15, blank=True, default='')
    bio = models.TextField(max_length=500, blank=True, default='')
    location = models.CharField(max_length=30, blank=True, default='')
    birth_date = models.DateField(null=True, blank=True)
    avatar = models.ImageField(default='default.jpg', upload_to='profile_images', blank=True, null=True)
    verified = models.BooleanField(default=False)  # If the profile has been reviewed by an admin


    def __str__(self):
        return self.user.get_username() if self.user else "Deleted User"
