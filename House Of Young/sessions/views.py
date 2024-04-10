import logging
from django.shortcuts import render, redirect, reverse
from django.contrib.sites.shortcuts import get_current_site
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.http import HttpResponse
from django.contrib import messages
from django.contrib.auth import login, logout, authenticate, get_user_model, update_session_auth_hash
from django.views.generic import UpdateView
from django.contrib.auth.decorators import login_required
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from .forms import SignUpForm, LoginForm, UserProfileUpdateForm
from .tokens import AccountActivationTokenGenerator
from custom_user.models import CustomUser
from django.contrib.auth.forms import PasswordChangeForm

logger = logging.getLogger(__name__)
User = get_user_model()


def register(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            if CustomUser.objects.filter(username=username).exists():
                form.add_error('username', 'This username is already in use. Please choose another one.')
            else:
                user = form.save(commit=False)
                user.is_active = False
                user.save()
                send_activation_email(request, user)
                return redirect('sessions:account_activation_sent')
        else:
            messages.error(request, 'There was an error in your registration. Please correct the highlighted fields.')
    else:
        form = SignUpForm()
    return render(request, 'sessions/signup.html', {'form': form})


def send_activation_email(request, user):
    protocol = request.scheme
    domain = request.get_host()
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = AccountActivationTokenGenerator().make_token(user)
    activation_link = f"{protocol}://{domain}/sessions/activate/{uidb64}/{token}/"
    subject = 'Activate Your House Of Young Account'
    message = render_to_string('sessions/activate_account_email.html', {
        'user': user,
        'activation_link': activation_link,
    })
    send_mail(
        subject,
        strip_tags(message),
        from_email='infohouseofyoung@gmail.com',
        recipient_list=[user.email],
        fail_silently=False,
        html_message=message
    )
    logger.debug(f"Activation Link: {activation_link}")


def activate(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = CustomUser.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
        user = None

    if user is not None and AccountActivationTokenGenerator().check_token(user, token):
        user.is_active = True
        user.save()
        messages.success(request, "Thank you for verifying your email. Your account has been successfully activated.")
        return redirect('sessions:login')
    else:
        return HttpResponse('Activation link invalid!')


def account_activation_sent(request):
    return render(request, 'sessions/account_activation_sent.html')


def user_login(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            password = form.cleaned_data['password']
            user = authenticate(request, email=email, password=password)
            if user is not None and user.is_active:
                login(request, user)
                return redirect(request.GET.get('next', 'core:index'))
            elif user is not None and not user.is_active:
                messages.error(request, 'This account is inactive.')
            else:
                messages.error(request, 'Invalid email or password.')
        else:
            messages.error(request, 'There was an error in your form. Please correct the highlighted fields.')
    else:
        form = LoginForm()
    return render(request, 'sessions/login.html', {'form': form})


@login_required
def user_logout(request):
    logout(request)
    messages.success(request, "You have been logged out successfully.")
    return redirect('core:index')


class ProfileUpdateView(UpdateView):
    model = User
    template_name = 'sessions/profile.html'
    fields = ['first_name', 'last_name', 'email']

    def get_object(self):
        return self.request.user

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['profile'] = self.request.user.userprofile
        return context

    def form_valid(self, form):
        user_profile = self.request.user.userprofile
        user_profile.phone_number = self.request.POST.get('phone_number', '')
        user_profile.bio = self.request.POST.get('bio', '')
        user_profile.location = self.request.POST.get('location', '')
        user_profile.birth_date = self.request.POST.get('birth_date', None)
        user_profile.avatar = self.request.FILES.get('avatar', user_profile.avatar)
        user_profile.save()
        return super().form_valid(form)


@login_required
def profile_edit(request):
    form = UserProfileUpdateForm(instance=request.user.userprofile)
    if request.method == "POST":
        form = UserProfileUpdateForm(request.POST, request.FILES, instance=request.user.userprofile)
        if form.is_valid():
            form.save()
            messages.success(request, "Your profile has been updated successfully.")
            return redirect('sessions:profile')
        else:
            messages.error(request, "There was an error in your form. Please correct the highlighted fields.")
    return render(request, 'sessions/profile_edit.html', {'form': form})


@login_required
def password_change(request):
    if request.method == 'POST':
        form = PasswordChangeForm(user=request.user, data=request.POST)
        if form.is_valid():
            user = form.save()
            update_session_auth_hash(request, user)  # Update session to prevent logout
            messages.success(request, 'Your password was successfully updated!')
            return redirect('sessions:profile')
        else:
            messages.error(request, 'Please correct the error below.')
    else:
        form = PasswordChangeForm(user=request.user)
    return render(request, 'sessions/password_change.html', {'form': form})


def password_reset(request):
    if request.method == 'POST':
        # Logic to initiate password reset (send email with reset link)
        pass
    return render(request, 'sessions/password_reset.html')


def password_reset_confirm(request, uidb64, token):
    if request.method == 'POST':
        # Logic to process password reset confirmation
        pass
    return render(request, 'sessions/password_reset_confirm.html')


def password_reset_complete(request):
    return render(request, 'sessions/password_reset_complete.html')
