"""Studio Crowd: what the crowd wants to hear, the live DJ board, the venue QR code and DJ logins."""

from collections import Counter
from datetime import timedelta

import segno
from django import forms
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.utils.safestring import mark_safe
from django.views.decorators.http import require_POST

from apps.core.models import MusicStyle
from apps.core.roles import DJ_GROUP, sync_dj_group
from apps.crowd import taste
from apps.crowd.models import TasteAnswer
from apps.events.models import Event

from . import charts
from .access import ADDED, CHANGED, log, scoped, studio_view

User = get_user_model()
WINDOW = timedelta(days=90)
# No look-alike characters: DJs type these on a phone in a dark booth.
READABLE_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class DJLoginForm(forms.Form):
    name = forms.CharField(max_length=150, widget=forms.TextInput(attrs={"class": "in", "autocomplete": "off"}))
    username = forms.CharField(
        max_length=150,
        validators=[UnicodeUsernameValidator()],
        help_text="What they type to log in. Letters, digits and @ . + - _ only.",
        widget=forms.TextInput(attrs={"class": "in", "autocomplete": "off", "autocapitalize": "none", "spellcheck": "false"}),
    )

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError("That username is taken.")
        return username


def new_password():
    return "-".join(get_random_string(4, READABLE_CHARS) for _ in range(4))


def _shown_once(request, user, password):
    return {"user": user, "password": password, "login_url": request.build_absolute_uri(reverse("studio:login"))}


def dj_users():
    """Logins Studio may manage as DJs: not admins, no permissions of their own and no group but DJs.

    Anything wider could be taken over by resetting its password here.
    """
    return (
        User.objects.filter(groups__name=DJ_GROUP, is_superuser=False)
        .exclude(groups__in=Group.objects.exclude(name=DJ_GROUP))
        .exclude(user_permissions__isnull=False)
        .distinct()
        .order_by("-is_active", "first_name", "username")
    )


def tonight_url(event):
    return f"{settings.HOY_SITE_URL}/tonight/{event.slug}"


def qr_svg(event):
    code = segno.make(tonight_url(event), error="m")
    svg = code.svg_inline(omitsize=True, border=2, dark="#111", light="#fff", svgclass="qr", title=f"QR code for {event.title}")
    return mark_safe(svg)  # noqa: S308 - segno escapes the title, and the code holds our own URL


def _overview(request, status=200, **extra):
    now = timezone.now()
    answers = scoped(TasteAnswer.objects.filter(created_at__gte=now - WINDOW), request)
    names = dict(MusicStyle.objects.values_list("slug", "name"))
    events = (
        scoped(Event.objects.filter(status=Event.Status.PUBLISHED).select_related("city", "venue"), request)
        .filter(starts_at__gte=now - WINDOW)
        .annotate(answers=Count("taste_answers"))
        .order_by("starts_at")
    )
    rows = [{"e": e, "open": taste.is_open(e), "live": taste.is_live(e)} for e in events]
    can_manage = request.user.has_perm("crowd.manage_djs")
    ctx = {
        "nav": "crowd",
        "total": answers.count(),
        "genres": charts.bars(taste.genre_shares(answers.values_list("genres", flat=True), names)[:8], value_key="count"),
        "artists": charts.bars(taste.top_texts(answers.values_list("artist", flat=True))),
        "upcoming": [r for r in rows if r["open"]],
        "past": [r for r in reversed(rows) if not r["open"]],
        "can_manage": can_manage,
        "djs": dj_users() if can_manage else [],
        "dj_form": DJLoginForm(),
        **extra,
    }
    response = render(request, "studio/crowd.html", ctx, status=status)
    if "new_login" in extra:
        response["Cache-Control"] = "no-store"
    return response


@studio_view("crowd.view_tasteanswer")
def overview(request):
    return _overview(request)


def _board(event):
    answers = list(event.taste_answers.all())
    sources = Counter(a.source for a in answers)
    return {
        "total": len(answers),
        "from_tickets": sources[TasteAnswer.Source.TICKET],
        "from_qr": sources[TasteAnswer.Source.QR],
        "genres": charts.bars(taste.genre_shares([a.genres for a in answers], dict(taste.genre_options(event))), value_key="count"),
        "artists": charts.bars(taste.top_texts([a.artist for a in answers])),
        "songs": taste.song_requests(answers),
        "hidden": sum(1 for a in answers if a.song and a.song_hidden),
        "open": taste.is_open(event),
        "live": taste.is_live(event),
        "updated": timezone.now(),
    }


@studio_view("crowd.view_tasteanswer")
def board(request, pk):
    event = get_object_or_404(scoped(Event.objects.select_related("city", "venue"), request), pk=pk)
    ctx = {"nav": "crowd", "event": event, **_board(event)}
    if request.GET.get("partial"):
        return render(request, "studio/_crowd_board.html", ctx)
    return render(request, "studio/crowd_event.html", {**ctx, "qr": qr_svg(event), "tonight_url": tonight_url(event)})


@require_POST
@studio_view("crowd.change_tasteanswer")
def hide_song(request, pk):
    event = get_object_or_404(scoped(Event.objects.all(), request), pk=pk)
    key = request.POST.get("song", "")
    ids = [a.pk for a in event.taste_answers.exclude(song="") if taste.text_key(a.song) == key]
    if TasteAnswer.objects.filter(pk__in=ids).update(song_hidden=True):
        log(request, event, CHANGED, "hid a song request on the crowd board")
        messages.success(request, "Hidden from the board.")
    return redirect("studio:crowd_event", pk=event.pk)


@studio_view("crowd.view_tasteanswer")
def qr(request, pk):
    event = get_object_or_404(scoped(Event.objects.select_related("city", "venue"), request), pk=pk)
    return render(request, "studio/crowd_qr.html", {"event": event, "qr": qr_svg(event), "tonight_url": tonight_url(event)})


@require_POST
@studio_view("crowd.manage_djs")
def dj_create(request):
    form = DJLoginForm(request.POST)
    if not form.is_valid():
        return _overview(request, status=400, dj_form=form)
    password = new_password()
    user = User.objects.create_user(form.cleaned_data["username"], password=password, first_name=form.cleaned_data["name"], is_staff=True)
    user.groups.set([sync_dj_group()])
    log(request, user, ADDED, "DJ login created in Studio")
    return _overview(request, new_login=_shown_once(request, user, password))


@require_POST
@studio_view("crowd.manage_djs")
def dj_update(request, pk):
    user = get_object_or_404(dj_users(), pk=pk)
    name = user.get_full_name() or user.get_username()
    if request.POST.get("action") == "password":
        password = new_password()
        user.set_password(password)
        user.save(update_fields=["password"])
        log(request, user, CHANGED, "DJ password replaced in Studio")
        return _overview(request, new_login=_shown_once(request, user, password))
    user.is_active = not user.is_active
    user.save(update_fields=["is_active"])
    log(request, user, CHANGED, "DJ login switched on" if user.is_active else "DJ login switched off")
    messages.success(request, f"{name} can log in again." if user.is_active else f"{name} can no longer log in.")
    return redirect(reverse("studio:crowd") + "#djs")
