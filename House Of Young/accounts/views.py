from django.contrib.auth.views import LoginView
from django.views.generic.edit import CreateView
from django.urls import reverse_lazy
from django.contrib.auth import login, get_user_model
from django.core.mail import EmailMessage
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.sites.shortcuts import get_current_site
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.template.loader import render_to_string
from .tokens import account_activation_token
from django.contrib import messages
from django.http import HttpResponseRedirect
from django.shortcuts import render, redirect
from .forms import SignUpForm

User = get_user_model()

class RegisterView(CreateView):
    template_name = 'accounts/signup.html'
    form_class = SignUpForm
    success_url = reverse_lazy('accounts:login')

    def form_valid(self, form):
        try:
            user = form.save(commit=False)
            user.is_active = False
            user.save()

            current_site = get_current_site(self.request)
            subject = 'Activate Your Account'
            message = render_to_string('accounts/activate_account.html', {
                'user': user,
                'domain': current_site.domain,
                'uid': urlsafe_base64_encode(force_bytes(user.pk)),
                'token': account_activation_token.make_token(user),
            })
            to_email = form.cleaned_data.get('email')
            email = EmailMessage(subject, message, to=[to_email])
            email.send()
            messages.success(self.request, ('Please confirm your email to complete registration.'))
            return HttpResponseRedirect(self.get_success_url())
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error in RegisterView: {e}", exc_info=True)
            messages.error(self.request, "An error occurred during registration.")
            return render(self.request, 'accounts/signup.html', {'form': form})





def activate_account(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)

    except User.DoesNotExist:
        user = None

    if user is not None and account_activation_token.check_token(user, token):
        user.is_active = True
        user.save()
        login(request, user)
        messages.success(request, ('Your account has been confirmed.'))
        return redirect('core:index')
    else:
        messages.warning(request, ('The confirmation link was invalid, possibly because it has already been used.'))
        return redirect('accounts:signup')



class CustomLoginView(LoginView):
    template_name = 'accounts/login.html'
    form_class = AuthenticationForm
    success_url = reverse_lazy('core:index')
