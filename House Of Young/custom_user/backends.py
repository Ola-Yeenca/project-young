
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.db.models.base import Model
from typing import Union
from .models import CustomUser

class AdminBackend(ModelBackend):
    def has_perm(self, user_obj: Union[Model, AnonymousUser], perm: str, obj: Model = None) -> bool:
        return super().has_perm(user_obj, perm, obj)

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        try:
            user = UserModel.objects.get(email=username)
        except UserModel.DoesNotExist:
            return None
        else:
            if user.check_password(password):
                return user
        return None

    def get_user(self, user_id):
        UserModel = get_user_model()
        try:
            return UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return None


class CustomUserManager(ModelBackend):
    def authenticate(self, request, email=None, password=None, **kwargs):
        try:
            user = CustomUser.objects.get(email=email)  # Querying the CustomUser model explicitly
            print('Attempting to find user with email:', email)
            print('Found user:', user)
        except CustomUser.DoesNotExist:
            print('User with email not found:', email)
            return None
        else:
            if user.check_password(password):
                print('Password matches')
                return user
            else:
                print('Invalid password')
        return None

    def get_user(self, user_id):
        UserModel = get_user_model()
        try:
            return UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return None
