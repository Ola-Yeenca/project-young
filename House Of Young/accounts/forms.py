from django import forms
from django.core.validators import RegexValidator
from django.contrib.auth.forms import UserCreationForm
from .models import CustomUser

class SignUpForm(UserCreationForm):
    email = forms.EmailField(max_length=254, help_text='Required')
    phone_number = forms.CharField(max_length=15, validators=[RegexValidator(regex=r'^[\d\+\-]{9,15}$', message='Enter a valid phone number.')])

    class Meta:
        model = CustomUser
        fields = ('email', 'phone_number', 'password1', 'password2')

class LoginForm(forms.Form):
    email = forms.EmailField(max_length=254)
    password = forms.CharField(widget=forms.PasswordInput)
