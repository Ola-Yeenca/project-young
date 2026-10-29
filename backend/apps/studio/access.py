"""Who can use Studio, which city they are looking at, and the audit trail."""

from functools import wraps

from django.contrib import messages
from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied

from apps.core.models import City

ADDED, CHANGED, DELETED = ADDITION, CHANGE, DELETION


def studio_view(perm=None):
    """Staff only. Optionally also requires a model permission such as "events.change_event"."""

    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            user = request.user
            if not user.is_authenticated:
                return redirect_to_login(request.get_full_path(), "studio:login")
            if not (user.is_active and user.is_staff):
                raise PermissionDenied("Studio is for the HOY team.")
            if perm and not user.has_perm(perm):
                messages.error(request, "You don't have access to that section. Ask an admin to add you to the HOY team group.")
                raise PermissionDenied
            return view(request, *args, **kwargs)

        return wrapped

    return decorator


SCOPE_KEY = "studio_city"


def current_city(request):
    """The city the whole Studio is filtered to, or None for all cities."""
    slug = request.session.get(SCOPE_KEY)
    if not slug:
        return None
    return City.objects.filter(slug=slug).first()


def scoped(qs, request, field="city"):
    city = current_city(request)
    return qs.filter(**{field: city}) if city else qs


def log(request, obj, flag, message=""):
    """Record a Studio change in Django's admin history, so both tools share one audit trail."""
    LogEntry.objects.log_actions(user_id=request.user.pk, queryset=[obj], action_flag=flag, change_message=message, single_object=True)
