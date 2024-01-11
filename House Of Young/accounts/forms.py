from django import forms
from django.contrib.auth.models import User
import random
import string
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.core.validators import EmailValidator
from django.contrib.auth import get_user_model

CustomUser = get_user_model()

class UserRegistrationForm(forms.ModelForm):
    password = forms.CharField(label='Password', max_length=7, required=True)

    class Meta:
        model = CustomUser
        fields = ('email', 'phone_number', 'password')

    def clean(self, *args, **kwargs):
        email = self.cleaned_data.get('email')
        phone_number = self.cleaned_data.get('phone_number')
        password = self.cleaned_data.get('password', '')

        email_check = CustomUser.objects.filter(email=email)
        if email_check.exists():
            raise forms.ValidationError("This email is already in use")

        if len(password) < 7:
            raise forms.ValidationError("Password must be at least 7 characters")

        if CustomUser.objects.filter(phone_number=phone_number).exists():
            raise forms.ValidationError("This phone number is already in use")

        return super(UserRegistrationForm, self).clean(*args, **kwargs)



class SignupForm(UserCreationForm):
    email = forms.EmailField(
        widget=forms.TextInput(attrs={
            'placeholder': 'Your email',
            'class': 'w-full py-4 px-6 rounded-xl'
        }),
        validators=[EmailValidator(message='Enter a valid email address')]
    )
    phone_number = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your phone number',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    password1 = forms.CharField(widget=forms.PasswordInput(attrs={
        'placeholder': 'Your password',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    password2 = forms.CharField(widget=forms.PasswordInput(attrs={
        'placeholder': 'Confirm password',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']

        verification_code = ''.join(random.choices(string.digits, k=6))
        user.profile.verification_code = verification_code
        user.profile.save()

        if commit:
            user.save()

        return user

    class Meta:
        model = CustomUser
        fields = ('email', 'phone_number', 'password1', 'password2')




class LoginForm(AuthenticationForm):
    username = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your username',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    password = forms.CharField(widget=forms.PasswordInput(attrs={
        'placeholder': 'Your password',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))

    class Meta:
        model = User
        fields = ('username', 'password')

class ResetPasswordForm(forms.Form):
    email = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your email',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    class Meta:
        model = User
        fields = ('email',)
class ChangePasswordForm(forms.Form):
    new_password = forms.CharField(widget=forms.PasswordInput(attrs={
        'placeholder': 'Your new password',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    confirm_password = forms.CharField(widget=forms.PasswordInput(attrs={
        'placeholder': 'Confirm password',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))

    class Meta:
        model = User
        fields = ('new_password', 'confirm_password')

class EditProfileForm(forms.Form):
    username = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your username',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    email = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your email',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    phone_number = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your phone number',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    class Meta:
        model = User
        fields = ('username', 'email', 'phone_number')

class ProfileForm(forms.Form):
    username = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your username',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    email = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your email',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    phone_number = forms.CharField(widget=forms.TextInput(attrs={
        'placeholder': 'Your phone number',
        'class': 'w-full py-4 px-6 rounded-xl'
    }))
    class Meta:
        model = User
        fields = ('username', 'email', 'phone_number')
