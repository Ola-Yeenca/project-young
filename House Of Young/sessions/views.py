import logging
from django.shortcuts import render, redirect, reverse, get_object_or_404
from django.contrib.sites.shortcuts import get_current_site
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.http import HttpResponse, JsonResponse
from django.contrib.auth import login, logout, authenticate, REDIRECT_FIELD_NAME
from django.contrib import messages
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.contrib.auth.decorators import login_required, permission_required




from .forms import SignUpForm, LoginForm, UserProfileUpdateForm
from .tokens import AccountActivationTokenGenerator
from custom_user.models import CustomUser
from custom_user.backends import CustomUserManager



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
                message = render_to_string('sessions/activate_account_email.html', {
                    'user': user,
                    'protocol': protocol,
                    'domain': domain,
                    'uidb64': uidb64,
                    'token': AccountActivationTokenGenerator().make_token(user),
                })
                logger.debug(f"Activation Link: {protocol}://{domain}/sessions/activate/{uidb64}/{AccountActivationTokenGenerator().make_token(user)}/")
                send_mail(
                    subject,
                    strip_tags(message),
                    from_email='infohouseofyoung@gmail.com',
                    recipient_list=[user.email],
                    fail_silently=False,
                    html_message=message
                )
                return redirect(reverse('sessions:account_activation_sent'))
        else:
            messages.error(request, 'There was an error in your registration. Please correct the highlighted fields.')

    else:
        form = SignUpForm()

    return render(request, 'sessions/signup.html', {'form': form})

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

        next_url = request.GET.get('next', reverse('sessions:login'))
        if next_url and next_url.startswith('/'):
            return redirect(next_url)
        else:
            return redirect(reverse('sessions:login'))
    else:
        return HttpResponse('Activation link invalid!')

def account_activation_sent(request):
    return render(request, 'sessions/account_activation_sent.html')



def user_login(request):
    print('user_login')
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            password = form.cleaned_data['password']
            print('form is valid', email, password)


            user = authenticate(request, email=email, password=password, backend='custom_user.backends.CustomUserManager')
            print('user authenicated??', user)

            if user is not None:
                if user.is_active:
                    print('user is active')
                    login(request, user)
                    print(JsonResponse({'message': 'You have been logged in successfully'}).content)
                    next_url = request.GET.get('next', reverse('sessions:profile'))
                    print('next_url: ', next_url)
                    if next_url and next_url.startswith('/'):
                        return redirect(next_url)
                    else:
                        return redirect(reverse('core:index'))
                        print('redirecting to index')
                else:
                    messages.error(request, 'This account is inactive.')
            else:
                messages.error(request, 'Invalid email or password.')

        else:
            messages.error(request, 'There was an error in your form. Please correct the highlighted fields.')
            for msg in form.errors.values():
                messages.error(request, msg)
    else:
        form = LoginForm()

    context = {
        'form': form,
        'next': request.GET.get('next', '')
    }

    return render(request, 'sessions/login.html', context)

def user_logout(request):
    logout(request)
    messages.success(request, "You have been logged out successfully.")
    return redirect(reverse('core:index'))


@login_required
def profile(request):
    user = request.user
    user_form = UserProfileUpdateForm(instance=user)
    profile_form = UserProfileUpdateForm(instance=user.userprofile)

    if request.method == 'POST':
        user_form = UserProfileUpdateForm(request.POST, instance=user)
        profile_form = UserProfileUpdateForm(request.POST, request.FILES, instance=user.userprofile)

        if user_form.is_valid() and profile_form.is_valid():
            user_form.save()
            profile_form.save()
            messages.success(request, "Your profile has been updated successfully.")
            return redirect(reverse('sessions:profile'))
        else:
            messages.error(request, "There was an error in your form. Please correct the highlighted fields.")

    return render(request, 'sessions/profile.html', {'user_form': user_form, 'profile_form': profile_form})

@login_required
def profile_edit(request):
    form = UserProfileUpdateForm(instance=request.user.userprofile)

    if request.method == "POST":
        form = UserProfileUpdateForm(request.POST, request.FILES, instance=request.user.userprofile)
        if form.is_valid():
            form.save()
            messages.success(request, "Your profile has been updated successfully.")
            return redirect(reverse('sessions:profile'))
        else:
            messages.error(request, "There was an error in your form. Please correct the highlighted fields.")

    context = {"form": form}
    return render(request, 'sessions/profile_edit.html', context)


@permission_required
def password_change(request):
    pass

def password_reset(request):
    pass

def password_reset_confirm(request):
    pass

def password_reset_complete(request):
    pass
