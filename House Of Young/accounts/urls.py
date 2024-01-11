from django.urls import path
from .views import RegisterView, verify_user, CustomLoginView, login_user, reset_password, verify_email_sent, verify_email_done, verify_email_confirm, verification_success, password_changed, user_profile, edit_profile
from django.contrib.auth.views import LogoutView


app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomLoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(next_page='core:index'), name='logout'),
    path('reset-password/', reset_password, name='reset_password'),
    path('verify-email/', verify_email_sent, name='verify_email_sent'),
    path('verify-email-done/', verify_email_done, name='verify_email_done'),
    path('verify-email-confirm/<uidb64>/<token>/', verify_email_confirm, name='verify_email_confirm'),
    path('verify-email-complete/', verification_success, name='verify_email_complete'),
    path('password-changed/', password_changed, name='password_changed'),
    path('profile/', user_profile, name='profile'),
    path('edit-profile/', edit_profile, name='edit_profile'),
    path('verify-user/<verification_code>/', verify_user, name='verify_user'),
    # path('register-user/', register, name='register_user'),
]
