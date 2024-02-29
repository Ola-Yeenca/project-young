import logging
from django.shortcuts import render, redirect, reverse
from django.contrib.sites.shortcuts import get_current_site
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.http import HttpResponse
from django.contrib.auth import login, logout, authenticate, REDIRECT_FIELD_NAME
from django.contrib import messages
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.contrib.auth.decorators import login_required

from .forms import SignUpForm, LoginForm, UserProfileUpdateForm
from .tokens import AccountActivationTokenGenerator
from .models import CustomUser

logger = logging.getLogger(__name__)

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
                protocol = request.scheme
                domain = request.get_host()
                uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
                subject = 'Activate Your House Of Young Account'
                message = render_to_string('accounts/activate_account_email.html', {
                    'user': user,
                    'protocol': protocol,
                    'domain': domain,
                    'uidb64': uidb64,
                    'token': AccountActivationTokenGenerator().make_token(user),
                })
                logger.debug(f"Activation Link: {protocol}://{domain}/accounts/activate/{uidb64}/{AccountActivationTokenGenerator().make_token(user)}/")
                send_mail(
                    subject,
                    strip_tags(message),
                    from_email='infohouseofyoung@gmail.com',
                    recipient_list=[user.email],
                    fail_silently=False,
                    html_message=message
                )
                return redirect(reverse('accounts:account_activation_sent'))
        else:
            messages.error(request, 'There was an error in your registration. Please correct the highlighted fields.')

    else:
        form = SignUpForm()

    return render(request, 'accounts/signup.html', {'form': form})

def activate(request, uidb64, token):
    try:
        uid = force_bytes(urlsafe_base64_decode(uidb64))
        user = CustomUser.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
        user = None

    if user is not None and AccountActivationTokenGenerator().check_token(user, token):
        user.is_active = True
        user.save()

        # Move the messages.success line here
        messages.success(request, "Thank you for verifying your email. Your account has been successfully activated.")

        next_url = request.GET.get('next', reverse('accounts:login'))
        if next_url and next_url.startswith('/'):
            return redirect(next_url)
        else:
            return redirect(reverse('accounts:login'))
    else:
        return HttpResponse('Activation link invalid!')

def account_activation_sent(request):
    return render(request, 'accounts/account_activation_sent.html')

def user_login(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        user = authenticate(request, username=email, password=password)

        if user:
            if user.is_active:
                login(request, user)
                next_url = request.GET.get('next', reverse('accounts:profile'))
                return redirect(next_url)
            else:
                messages.error(request, 'Account not active!')
        else:
            messages.error(request, 'Invalid login credentials. Please try again.')

    form = LoginForm()
    return render(request, 'accounts/login.html', {'form': form, 'delay_redirect': True})


@login_required
def profile(request):
    if request.method == 'POST':
        form = UserProfileUpdateForm(request.POST, request.FILES, instance=request.user.userprofile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Your profile has been updated successfully.')
            next_url = request.GET.get('next', reverse('accounts:profile'))
            if next_url and next_url.startswith('/'):
                return redirect(next_url)
            else:
                return redirect(reverse('accounts:profile'))
        else:
            messages.error(request, 'There was an error in updating your profile. Please correct the highlighted fields.')
    else:
        form = UserProfileUpdateForm(instance=request.user.userprofile)
    return render(request, 'accounts/profile.html')


def user_logout(request):
    logout(request)
    return render(request, 'accounts/logout.html')

def admin_signup(request):
    form = SignUpForm()

    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect(reverse('admin:index'))

    return render(request, 'accounts/admin_signup.html', {'form': form})
