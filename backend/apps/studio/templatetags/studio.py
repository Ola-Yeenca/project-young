from django import template
from django.utils import timezone

register = template.Library()


@register.filter
def initials(user_or_name):
    name = user_or_name.get_full_name() or user_or_name.get_username() if hasattr(user_or_name, "get_username") else str(user_or_name)
    parts = [p for p in name.replace(".", " ").split() if p]
    return ("".join(p[0] for p in parts[:2]) or "?").upper()


@register.filter
def ago(value):
    if not value:
        return ""
    delta = timezone.now() - value
    s = int(delta.total_seconds())
    if s < 60:
        return "just now"
    if s < 3600:
        return f"{s // 60}m ago"
    if s < 86400:
        return f"{s // 3600}h ago"
    if s < 86400 * 7:
        return f"{s // 86400}d ago"
    return timezone.localtime(value).strftime("%d %b")


@register.filter
def money(amount, symbol=""):
    if amount is None:
        return "TBA"
    if amount == 0:
        return "Free"
    return f"{symbol}{amount:,.0f}"


@register.filter
def field_type(bound_field):
    return bound_field.field.widget.__class__.__name__


@register.simple_tag(takes_context=True)
def keep(context, **kwargs):
    """Current querystring with some keys replaced."""
    params = context["request"].GET.copy()
    for k, v in kwargs.items():
        if v in (None, ""):
            params.pop(k, None)
        else:
            params[k] = v
    return "?" + params.urlencode() if params else "?"
