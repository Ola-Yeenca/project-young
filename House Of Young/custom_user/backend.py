from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import AnonymousUser
from django.db.models.base import Model
from typing import Union

class AdminBackend(ModelBackend):
    def has_perm(self, user_obj: Union[Model, AnonymousUser], perm: str, obj: Model = None) -> bool:
        return super().has_perm(user_obj, perm, obj)
