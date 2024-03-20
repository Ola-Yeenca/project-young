from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from custom_user.models import CustomUser, UserProfile
from django.contrib.auth import get_user_model




class SignUpForm(UserCreationForm):
    email = forms.EmailField(max_length=254, help_text='Required. Inform a valid email address.')
    full_name = forms.CharField(max_length=30)

    def clean_email(self):
        email = self.cleaned_data.get('email')
        try:
            match = CustomUser.objects.get(email=email)
        except CustomUser.DoesNotExist:
            return email
        raise forms.ValidationError('This email address is already in use.')

    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'full_name', 'password1', 'password2', )




class LoginForm(forms.Form):
    email = forms.EmailField(max_length=254, help_text='Required. Inform a valid email address.')
    password = forms.CharField(widget=forms.PasswordInput)

    error_messages = {
        'invalid_login': (
            "Please enter a correct %(username)s and password. Note that both "
            "fields may be case-sensitive."
        ),
        'inactive': ("This account is inactive."),
    }


class Profile(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['avatar']

class UserProfileUpdateForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['avatar', 'bio', 'location', 'phone_number', 'birth_date']
        widgets = {
            'avatar': forms.ImageField(),
            'bio': forms.Textarea(),
            'location': forms.TextInput(),
            'phone_number': forms.TextInput(),
            'birth_date':
            forms.DateInput(attrs={'type': 'date'})
        }
