from django.urls import path, re_path
from .views import RegisterView,  CustomLoginView, activate_account
from django.contrib.auth.views import LogoutView


app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    re_path(r'activate/(?P<uidb64>[0-9A-Za-z_\-]+)/(?P<token>[0-9A-Za-z]{1,13}-[0-9A-Za-z]{1,20})/', activate_account, name='activate'),
    #path('verify-user/<uidb64>/<token>/', verify_user, name='verify_user'),
    path('login/', CustomLoginView.as_view(), name='login'),
    # path('login-user/', login_user, name='login_user'),
    path('logout/', LogoutView.as_view(), name='logout'),
    # path('reset-password/', reset_password, name='reset_password'),
    # path('verify-email-sent/', verify_email_sent, name='verify_email_sent'),
    # path('verify-email-done/', verify_email_done, name='verify_email_done'),
    # path('verify-email-confirm/<uidb64>/<token>/', verify_email_confirm, name='verify_email_confirm'),
    # path('verification-success/', verification_success, name='verification_success'),
    # path('password-changed/', password_changed, name='password_changed'),
    # path('user-profile/', user_profile, name='user_profile'),
    # path('edit-profile/', edit_profile, name='edit_profile'),
]
