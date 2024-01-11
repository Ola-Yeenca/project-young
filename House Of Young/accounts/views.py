from django.contrib.auth.views import LoginView, LogoutView
from django.views.generic.edit import CreateView
from django.urls import reverse_lazy
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, get_user_model, authenticate
from django.core.mail import send_mail, EmailMessage
from django.contrib.auth.forms import AuthenticationForm
from django.conf import settings
from django.contrib.auth.decorators import login_required
from .forms import SignupForm, ResetPasswordForm, ChangePasswordForm, ProfileForm, EditProfileForm
from django.contrib.sites.shortcuts import get_current_site
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.template.loader import render_to_string
from .tokens import account_activation_token
from django.contrib import messages
from django.http import HttpResponseRedirect

CustomUser = get_user_model()

class RegisterView(CreateView):
    form_class = SignupForm
    template_name = 'accounts/signup.html'
    success_url = reverse_lazy('accounts:verify_email')  # Update this to the correct URL

    def form_valid(self, form):
        print('Entering form for validation...')
        response = super().form_valid(form)
        print('Form is valid')
        verification_code = form.cleaned_data.get('verification_code')
        print(f"Verification code: {verification_code}")
        email = form.cleaned_data.get('email')
        subject = 'House Of Young Verification Code'
        message = f'Welcome to House Of Young. Your verification code is {verification_code}'

        try:
            send_mail(subject, message, settings.EMAIL_HOST_USER, [email], fail_silently=False)
        except Exception as e:
            print(f"Error sending email: {e}")

        login(self.request, self.object)

        return HttpResponseRedirect(self.get_success_url())  # Ensure it redirects to the correct URL




class CustomLoginView(LoginView):
    template_name = 'accounts/login.html'

def verify_user(request, verification_code):
    if request.method == "POST":
        user = CustomUser.objects.filter(profile__verification_code=verification_code).first()
        if user and not user.email_is_verified:
            current_site = get_current_site(request)
            email = user.email
            subject = 'House Of Young Verification Code'
            message = render_to_string('user/verify_email_message.html', {
                'request': request,
                'user': user,
                'domain': current_site.domain,
                'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                'token': account_activation_token.make_token(user),
            })
            email = EmailMessage(subject, message, to=[email])
            email.content_subtype = 'html'
            email.send()
            return redirect('verify-email-done')
        else:
            return redirect('core:index')
    return render(request, 'accounts/verification_success.html')

def login_user(request):
    if request.user.is_authenticated:
        return redirect('core:index')

    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            email = form.cleaned_data['username']
            password = form.cleaned_data['password']

            user = authenticate(request, email=email, password=password)

            if user is not None and user.is_active:
                login(request, user)
                return redirect('core:index')
            else:
                if not CustomUser.objects.filter(email=email).exists():
                    return redirect('accounts:register')
    else:
        form = AuthenticationForm()

    return render(request, 'accounts/login.html', {'form': form})

# ... (rest of the unchanged functions)


user_login = CustomLoginView.as_view()
user_logout = LogoutView.as_view(next_page='core:index')

def reset_password(request):
    if request.method == 'POST':
        form = ResetPasswordForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data.get('email')
            user = get_object_or_404(CustomUser, email=email)
            new_password = form.cleaned_data['new_password']
            confirm_password = form.cleaned_data['confirm_password']
            if new_password == confirm_password:
                user.set_password(new_password)
                user.save()
                return redirect('accounts:login')
            else:
                return redirect('accounts:reset_password')
    else:
        form = ResetPasswordForm()

    return render(request, 'accounts/reset_password.html', {'form': form})

def verify_email_sent(request):
    return render(request, 'accounts/verify_email_sent.html')

def verify_email_done(request):
    return render(request, 'accounts/verify_email_done.html')

def verify_email_confirm(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = CustomUser.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, CustomUser.DoesNotExist):
        user = None

    if user is not None and account_activation_token.check_token(user, token):
        user.email_is_verified = True
        user.save()
        messages.success(request, 'Your email has been verified successfully')
        return redirect('verify-email-complete')
    else:
        messages.error(request, 'Invalid verification link')
        return redirect('core:index')

def verification_success(request):
    return render(request, 'accounts/verification_success.html')

@login_required
def password_changed(request):
    if request.method == 'POST':
        form = ChangePasswordForm(request.POST)
        if form.is_valid():
            user = request.user
            new_password = form.cleaned_data['new_password']
            confirm_password = form.cleaned_data['confirm_password']
            if new_password == confirm_password:
                user.set_password(new_password)
                user.save()
                return redirect('accounts:login')
            else:
                return redirect('accounts:password_changed')
    else:
        form = ChangePasswordForm()

    return render(request, 'accounts/password_changed.html', {'form': form})

@login_required
def user_profile(request):
    form = ProfileForm(instance=request.user.profile)
    if request.method == 'POST':
        form = ProfileForm(request.POST, instance=request.user.profile)
        if form.is_valid():
            form.save()
        return redirect('accounts:profile')
    else:
        return render(request, 'accounts/profile.html', {'form': form})

@login_required
def edit_profile(request):
    if request.method == 'POST':
        form = EditProfileForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
        return redirect('accounts:profile')
    else:
        return render(request, 'accounts/edit_profile.html', {})
