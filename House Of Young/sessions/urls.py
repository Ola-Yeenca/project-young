from django.urls import path
from .views import register, activate, account_activation_sent, user_login, logout, profile, profile_edit, password_change, password_reset, password_reset_confirm, password_reset_complete
from django.contrib.auth import views



app_name = 'sessions'

urlpatterns = [
    path('register/', register, name='register'),
    path('activate/<str:uidb64>/<str:token>/', activate, name='activate'),
    path('account_activation_sent/', account_activation_sent, name='account_activation_sent'),
    path('login/', user_login, name='login'),
    path('logout/', logout, name='logout'),
    path('profile/', profile, name='profile'),
    # path('profile_edit/', profile_edit, name='profile_edit'),
    # path('password_change/', password_change, name='password_change'),
    # path('password_reset/', password_reset, name='password_reset'),
    # path('password_reset_confirm/', password_reset_confirm, name='password_reset_confirm'),
    # path('password_reset_complete/', password_reset_complete, name='password_reset_complete'),
]
