from django.urls import path
from .views import register, activate, user_login, user_logout, account_activation_sent, admin_signup, profile

app_name = 'accounts'

urlpatterns = [
    path('register/', register, name='register'),
    path('activate/<str:uidb64>/<str:token>/', activate, name='activate'),
    path('account_activation_sent/', account_activation_sent, name='account_activation_sent'),
    path('login/', user_login, name='login'),
    path('logout/', user_logout, name='logout'),
    # For admin to create a new user (only available for superusers)
    path('admin_signup/', admin_signup, name='admin_signup'),
    path('profile/', profile, name='profile'),
]
