from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.contrib.auth import get_user_model
from django.views.generic import CreateView
from .forms import SignUpForm
from django.http import HttpResponse
from django.contrib.auth import login, authenticate
from django.contrib.sites.shortcuts import get_current_site
from django.utils.encoding import force_bytes, force_str
from django.utils.http import  urlsafe_base64_encode
from .tokens import AccountActivationTokenGenerator
from django.urls import reverse_lazy



def register(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.is_active = False
            user.save()

            current_site = get_current_site(request)
            subject = 'Activate Your House Of Young Account'
            message = render(request, 'accounts/account_activation_email.html', {
                'user': user,
                'domain': current_site.domain,
                'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                'token': AccountActivationTokenGenerator.make_token(user),
            })
            user.email_user(subject=subject, message=message)
            return redirect('account_activation_sent')

    else:
        form = SignUpForm()


    return render(request, 'accounts/signup.html', {'form' : form})


def activate(request, uidb64, token):
    CustomUser = get_user_model()
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
