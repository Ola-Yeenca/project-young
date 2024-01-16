from django.shortcuts import render, redirect
from django.contrib.sites.shortcuts import get_current_site
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.http import HttpResponse
from django.contrib.auth import login
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from .forms import SignUpForm
from .tokens import AccountActivationTokenGenerator
from .models import CustomUser




def register(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            if CustomUser.objects.filter(username=username).exists():
                form.add_error(username, 'This username is already in use.')
            else:
                user = form.save(commit=False)
                user.is_active = False
                user.save()

                current_site = get_current_site(request)
                subject = 'Activate Your House Of Young Account'
                message = render_to_string(request, 'accounts/activate_account_email.html', {
                    'user': user,
                    'domain': current_site.domain,
                    'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                    'token': AccountActivationTokenGenerator().make_token(user),
                })
                send_mail(
                    subject,
                    strip_tags(message),
                    from_email='infohouseofyoung@gmail.com',
                    recipient_list=[user.email],
                    fail_silently=False,
                    html_message=message
                )
                return redirect('accounts:account_activation_sent')

    else:
        form = SignUpForm()

    return render(request, 'accounts/signup.html', {'form': form})


def activate(request, uidb64, token):
    try:
        uid = force_bytes(urlsafe_base64_encode(uidb64))
        user = CustomUser.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
        user = None

    if user is not None and AccountActivationTokenGenerator().check_token(user, token):
        user.is_active = True
        user.save()
        login(request, user)
        return HttpResponse('Thank you for your email confirmation. Now you can log in to your account.')
    else:
        return HttpResponse('Activation link invalid!')


def account_activation_sent(request):
    return render(request, 'accounts/account_activation_sent.html')


def user_login(request):
    return render(request, 'accounts/login.html')


def user_logout(request):
    return render(request, 'accounts/logout.html')


def admin_signup(request):
    form = SignUpForm()

    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('admin:index')

    return render(request, 'accounts/admin_signup.html', {'form': form})
