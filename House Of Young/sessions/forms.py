from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from custom_user.models import CustomUser, UserProfile
from PIL import Image





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
        fields = ['avatar', 'user', 'phone_number', 'bio']

    def __init__(self, *args, **kwargs):
        super(UserProfileUpdateForm, self).__init__(*args, **kwargs)
        self.fields['avatar'].widget.attrs.pop('required', None)

    def clean_avatar(self):
        avatar = self.cleaned_data.get('avatar')
        if avatar:
            if avatar.size > 2 * 1024 * 1024:
                raise forms.ValidationError('Image file too large ( > 2mb )')
            image = Image.open(avatar)
            width, height = image.size

            if width > 300 or height > 300:
                raise forms.ValidationError('Image dimensions exceed 300x300')

            # Ensure the image is a perfect square (optional)
            if width != height:
                raise forms.ValidationError('Image is not a perfect square')

            return avatar
        else:
            return avatar
