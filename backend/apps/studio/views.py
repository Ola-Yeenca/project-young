import re
from datetime import timedelta

from django.contrib import messages
from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.views import LoginView, LogoutView
from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from apps.core.models import City, MediaKind, SiteSettings
from apps.enquiries.models import BookingEnquiry, ContactEnquiry, EnquiryBase
from apps.events.models import Event
from apps.gallery.models import Album, AlbumItem
from apps.shop.models import Product
from apps.talent.models import Talent, TalentMedia

from . import charts
from .access import ADDED, CHANGED, DELETED, SCOPE_KEY, current_city, log, scoped, studio_view
from .forms import (
    AlbumForm,
    EnquiryUpdateForm,
    EventForm,
    FAQFormSet,
    PriceFormSet,
    ProductForm,
    SiteSettingsForm,
    TalentForm,
    UploadForm,
    VariantFormSet,
)

OVERDUE_AFTER = timedelta(hours=24)
OPEN_STATUSES = [EnquiryBase.Status.NEW, EnquiryBase.Status.IN_PROGRESS, EnquiryBase.Status.WAITING]


# ---------------------------------------------------------------- auth + scope


class StudioLogin(LoginView):
    template_name = "studio/login.html"
    redirect_authenticated_user = True

    def get_default_redirect_url(self):
        return reverse("studio:overview")


class StudioLogout(LogoutView):
    next_page = "studio:login"


@studio_view()
def set_scope(request, slug):
    if slug == "all":
        request.session.pop(SCOPE_KEY, None)
    else:
        get_object_or_404(City, slug=slug)
        request.session[SCOPE_KEY] = slug
    back = request.GET.get("next") or reverse("studio:overview")
    if not url_has_allowed_host_and_scheme(back, allowed_hosts={request.get_host()}):
        back = reverse("studio:overview")
    return redirect(back)


# ---------------------------------------------------------------- overview


def _enquiry_rows(request, statuses=None, kind=None, q=None):
    rows = []
    sources = []
    if kind in (None, "", "bk"):
        sources.append(("bk", scoped(BookingEnquiry.objects.select_related("talent", "assigned_to", "city"), request)))
    if kind in (None, "", "ct"):
        sources.append(("ct", scoped(ContactEnquiry.objects.select_related("assigned_to", "city"), request)))
    now = timezone.now()
    for code, qs in sources:
        if statuses:
            qs = qs.filter(status__in=statuses)
        if q:
            fields = ["email", "phone", "message"] + (
                ["client_name", "company", "event_location", "talent__name"] if code == "bk" else ["name", "subject"]
            )
            cond = Q()
            for f in fields:
                cond |= Q(**{f"{f}__icontains": q})
            qs = qs.filter(cond)
        for e in qs[:300]:
            rows.append(
                {
                    "kind": code,
                    "obj": e,
                    "key": f"{code}-{e.pk}",
                    "name": e.client_name if code == "bk" else e.name,
                    "title": (f"Booking · {e.talent.name}" if e.talent_id else "Booking · any act")
                    if code == "bk"
                    else e.get_category_display(),
                    "snippet": (f"{e.event_date:%d %b} · {e.event_location}" if code == "bk" else (e.subject or e.message))[:90],
                    "created": e.created_at,
                    "overdue": e.status == EnquiryBase.Status.NEW and now - e.created_at > OVERDUE_AFTER,
                }
            )
    rows.sort(key=lambda r: r["created"], reverse=True)
    return rows


def _daily_enquiries(request, days=28):
    today = timezone.localdate()
    start = today - timedelta(days=days - 1)
    counts = {start + timedelta(days=i): {"a": 0, "b": 0} for i in range(days)}
    since = timezone.make_aware(timezone.datetime.combine(start, timezone.datetime.min.time()))
    for key, model in (("a", BookingEnquiry), ("b", ContactEnquiry)):
        for created in scoped(model.objects.filter(created_at__gte=since), request).values_list("created_at", flat=True):
            d = timezone.localtime(created).date()
            if d in counts:
                counts[d][key] += 1
    out = []
    for d, c in counts.items():
        out.append(
            {
                "date": d,
                "a": c["a"],
                "b": c["b"],
                "label": d.strftime("%d %b") if d.weekday() == 0 else "",
                "tip": f"{d:%a %d %b}: {c['a']} booking{'s' if c['a'] != 1 else ''}, {c['b']} message{'s' if c['b'] != 1 else ''}",
            }
        )
    return out


def _delta(now_value, before_value):
    if before_value == 0:
        return {"dir": "up" if now_value else "flat", "text": f"+{now_value}" if now_value else "0"}
    pct = round((now_value - before_value) / before_value * 100)
    return {"dir": "up" if pct > 0 else "down" if pct < 0 else "flat", "text": f"{pct:+d}%"}


def _when(e, now):
    local = e.local_starts_at
    days = (local.date() - timezone.localtime(now, local.tzinfo).date()).days
    if days == 0:
        rel = "Tonight" if local.hour >= 17 else "Today"
    elif days == 1:
        rel = "Tomorrow"
    elif days > 1:
        rel = f"in {days} days"
    else:
        rel = f"{-days} days ago"
    return {"date": local.strftime("%a %d %b, %H:%M"), "rel": rel, "days": days}


@studio_view()
def overview(request):
    now = timezone.now()
    events = scoped(Event.objects.select_related("city", "venue"), request)
    upcoming = events.upcoming()
    next30 = upcoming.filter(starts_at__lte=now + timedelta(days=30))
    drafts_soon = events.filter(status=Event.Status.DRAFT, starts_at__gte=now, starts_at__lte=now + timedelta(days=30))
    bk, ct = scoped(BookingEnquiry.objects, request), scoped(ContactEnquiry.objects, request)
    new_count = bk.filter(status="new").count() + ct.filter(status="new").count()
    week, fortnight = now - timedelta(days=7), now - timedelta(days=14)
    this_week = bk.filter(created_at__gte=week).count() + ct.filter(created_at__gte=week).count()
    last_week = (
        bk.filter(created_at__gte=fortnight, created_at__lt=week).count()
        + ct.filter(created_at__gte=fortnight, created_at__lt=week).count()
    )
    overdue = [r for r in _enquiry_rows(request, statuses=["new"]) if r["overdue"]]
    sold = [e.sold_percent if not e.sold_out else 100 for e in next30 if e.sold_percent is not None or e.sold_out]
    avg_sold = round(sum(sold) / len(sold)) if sold else None
    won_now = bk.filter(status="won", updated_at__gte=now - timedelta(days=90)).count()
    won_before = bk.filter(status="won", updated_at__gte=now - timedelta(days=180), updated_at__lt=now - timedelta(days=90)).count()
    published_30 = next30.exclude(status="draft").count()

    kpis = [
        {
            "label": "New enquiries",
            "icon": "inbox",
            "sq": "blue",
            "value": new_count,
            "url": reverse("studio:enquiries") + "?status=new",
            "delta": _delta(this_week, last_week),
            "note": f"{this_week} this week vs {last_week} last week",
        },
        {
            "label": "Events next 30 days",
            "icon": "calendar",
            "sq": "ink",
            "value": next30.count() + drafts_soon.count(),
            "unit": "events",
            "url": reverse("studio:events"),
            "progress": round(published_30 / max(published_30 + drafts_soon.count(), 1) * 100),
            "note": f"{published_30} live · {drafts_soon.count()} draft",
        },
        {
            "label": "Tickets sold",
            "icon": "ticket",
            "sq": "gold",
            "value": f"{avg_sold}%" if avg_sold is not None else "—",
            "url": reverse("studio:events"),
            "progress": avg_sold or 0,
            "progress_class": "gold",
            "note": f"average across {len(sold)} events" if sold else "Add % sold to events",
        },
        {
            "label": "Bookings won",
            "icon": "check",
            "sq": "green",
            "value": won_now,
            "url": reverse("studio:enquiries") + "?status=won",
            "delta": _delta(won_now, won_before),
            "note": "last 90 days",
        },
    ]

    attention = []
    if overdue:
        names = ", ".join(r["name"] for r in overdue[:3])
        attention.append(
            {
                "tone": "critical",
                "icon": "clock",
                "title": f"{len(overdue)} enquir{'ies' if len(overdue) != 1 else 'y'} waiting over 24 hours",
                "body": f"{names}{' and others' if len(overdue) > 3 else ''}. Clients expect a reply within one working day.",
                "cta": "Reply now",
                "url": reverse("studio:enquiries") + f"?status=new&open={overdue[0]['key']}",
            }
        )
    missing_poster = [e for e in upcoming.filter(starts_at__lte=now + timedelta(days=21)) if not e.poster]
    if missing_poster:
        e = missing_poster[0]
        attention.append(
            {
                "tone": "warning",
                "icon": "image",
                "title": f"{len(missing_poster)} upcoming event{'s' if len(missing_poster) != 1 else ''} without a poster",
                "body": f"{e.title} is {_when(e, now)['rel']}. Events with artwork get far more ticket clicks.",
                "cta": "Add artwork",
                "url": reverse("studio:event_edit", args=[e.pk]),
            }
        )
    no_tickets = [
        e for e in upcoming.filter(starts_at__lte=now + timedelta(days=30)) if not e.ticket_url and not e.is_free and not e.sold_out
    ]
    if no_tickets:
        e = no_tickets[0]
        attention.append(
            {
                "tone": "warning",
                "icon": "ticket",
                "title": f"{e.title} has no ticket link",
                "body": f"{_when(e, now)['date']} in {e.city}. Buyers can't purchase until it has one.",
                "cta": "Add ticket link",
                "url": reverse("studio:event_edit", args=[e.pk]),
            }
        )
    if drafts_soon.exists():
        e = drafts_soon.order_by("starts_at").first()
        attention.append(
            {
                "tone": "info",
                "icon": "draft",
                "title": f"{drafts_soon.count()} event{'s' if drafts_soon.count() != 1 else ''} still in draft",
                "body": f"{e.title} starts {_when(e, now)['rel']} and isn't on the site yet.",
                "cta": "Review and publish",
                "url": reverse("studio:event_edit", args=[e.pk]),
            }
        )
    hot = [e for e in next30 if (e.sold_percent or 0) >= 70 and not e.sold_out]
    if hot:
        e = hot[0]
        attention.append(
            {
                "tone": "info",
                "icon": "sparkle",
                "title": f"{e.title} is {e.sold_percent}% sold",
                "body": "Worth a push on Instagram, or feature it on the homepage record player.",
                "cta": "Open event",
                "url": reverse("studio:event_edit", args=[e.pk]),
            }
        )

    rows = []
    for e in upcoming.prefetch_related("lineup")[:7]:
        rows.append({"e": e, "when": _when(e, now)})
    for e in drafts_soon.order_by("starts_at")[:2]:
        rows.append({"e": e, "when": _when(e, now)})
    rows.sort(key=lambda r: r["e"].starts_at)

    daily = _daily_enquiries(request)
    demand = (
        bk.filter(created_at__gte=now - timedelta(days=90), talent__isnull=False)
        .values("talent__name", "talent__pk")
        .annotate(value=Count("id"))
        .order_by("-value")[:5]
    )
    hour = timezone.localtime().hour
    ctx = {
        "nav": "overview",
        "greeting": "Good morning" if hour < 12 else "Good afternoon" if hour < 19 else "Good evening",
        "kpis": kpis,
        "rows": rows,
        "attention": attention,
        "dm": charts.dot_matrix(daily),
        "daily": daily,
        "this_week": this_week,
        "last_week": last_week,
        "demand": charts.bars(list(demand)),
        "activity": LogEntry.objects.select_related("user", "content_type").order_by("-action_time")[:6],
        "now": now,
    }
    return render(request, "studio/overview.html", ctx)


# ---------------------------------------------------------------- enquiries


def _get_enquiry(key):
    m = re.fullmatch(r"(bk|ct)-(\d+)", key or "")
    if not m:
        return None, None
    model = BookingEnquiry if m.group(1) == "bk" else ContactEnquiry
    return m.group(1), model.objects.filter(pk=m.group(2)).select_related("assigned_to").first()


def _whatsapp(phone):
    digits = re.sub(r"\D", "", phone or "")
    return f"https://wa.me/{digits}" if len(digits) >= 8 else ""


@studio_view("enquiries.view_bookingenquiry")
def enquiries(request):
    status = request.GET.get("status", "open")
    kind = request.GET.get("kind", "")
    q = request.GET.get("q", "").strip()
    statuses = OPEN_STATUSES if status == "open" else None if status == "all" else [status]
    rows = _enquiry_rows(request, statuses=statuses, kind=kind or None, q=q or None)

    counts = {"open": 0, "all": 0}
    for code, model in (("bk", BookingEnquiry), ("ct", ContactEnquiry)):
        if kind and kind != code:
            continue
        for row in scoped(model.objects, request).values("status").annotate(n=Count("id")):
            counts[row["status"]] = counts.get(row["status"], 0) + row["n"]
            counts["all"] += row["n"]
            if row["status"] in OPEN_STATUSES:
                counts["open"] += row["n"]
    tabs = [
        ("open", "Open"),
        ("new", "New"),
        ("in_progress", "In progress"),
        ("waiting", "Waiting"),
        ("won", "Won"),
        ("lost", "Lost"),
        ("all", "All"),
    ]

    open_key = request.GET.get("open") or (rows[0]["key"] if rows and request.GET.get("first") else "")
    code, selected = _get_enquiry(open_key)
    detail = None
    if selected:
        steps = ["new", "in_progress", "waiting", "won"]
        reached = steps.index(selected.status) if selected.status in steps else (3 if selected.status in ("lost", "closed") else 0)
        detail = {
            "kind": code,
            "e": selected,
            "key": open_key,
            "name": selected.client_name if code == "bk" else selected.name,
            "whatsapp": _whatsapp(selected.phone),
            "steps": [{"key": s, "label": dict(EnquiryBase.Status.choices)[s], "done": i <= reached} for i, s in enumerate(steps)],
            "form": EnquiryUpdateForm(initial={"status": selected.status, "internal_notes": selected.internal_notes}),
            "statuses": EnquiryBase.Status.choices,
            "talent_enquiries": BookingEnquiry.objects.filter(talent=selected.talent).count() if code == "bk" and selected.talent_id else 0,
        }

    ctx = {
        "nav": "enquiries",
        "rows": rows,
        "tabs": [{"key": k, "label": label, "count": counts.get(k, 0), "on": k == status} for k, label in tabs],
        "status": status,
        "kind": kind,
        "q": q,
        "detail": detail,
        "team": get_user_model().objects.filter(is_staff=True, is_active=True).order_by("first_name", "username"),
        "cities": City.objects.filter(is_active=True),
    }
    return render(request, "studio/enquiries.html", ctx)


@require_POST
@studio_view("enquiries.change_bookingenquiry")
def enquiry_update(request, key):
    code, e = _get_enquiry(key)
    if not e:
        raise Http404
    form = EnquiryUpdateForm(request.POST)
    changes = []
    if form.is_valid():
        data = form.cleaned_data
        if data["status"] and data["status"] != e.status:
            e.status = data["status"]
            changes.append(f"status → {e.get_status_display()}")
        if "internal_notes" in request.POST and data["internal_notes"] != e.internal_notes:
            e.internal_notes = data["internal_notes"]
            changes.append("notes")
        assign = data["assign"]
        if assign == "me":
            e.assigned_to = request.user
            changes.append("assigned to me")
        elif assign == "none":
            e.assigned_to = None
            changes.append("unassigned")
        elif assign.isdigit():
            e.assigned_to = get_user_model().objects.filter(pk=assign, is_staff=True).first()
            changes.append("reassigned")
        if changes:
            e.save()
            log(request, e, CHANGED, ", ".join(changes))
            messages.success(request, f"{e.reference} updated: {', '.join(changes)}.")
    back = request.POST.get("back") or reverse("studio:enquiries")
    if not url_has_allowed_host_and_scheme(back, allowed_hosts={request.get_host()}):
        back = reverse("studio:enquiries")
    return redirect(back)


# ---------------------------------------------------------------- events


@studio_view("events.view_event")
def events(request):
    tab = request.GET.get("tab", "upcoming")
    base = scoped(Event.objects.select_related("city", "venue").prefetch_related("lineup"), request)
    now = timezone.now()
    lists = {
        "upcoming": base.filter(starts_at__gte=now - timedelta(hours=6)).exclude(status="draft").order_by("starts_at"),
        "drafts": base.filter(status="draft").order_by("starts_at"),
        "past": base.filter(starts_at__lt=now - timedelta(hours=6)).exclude(status="draft").order_by("-starts_at"),
    }
    qs = lists.get(tab, lists["upcoming"])
    tabs = [{"key": k, "label": k.title(), "count": v.count(), "on": k == tab} for k, v in lists.items()]
    return render(request, "studio/events.html", {"nav": "events", "events": qs, "tabs": tabs, "tab": tab, "now": now})


@studio_view("events.change_event")
def event_edit(request, pk=None):
    event = get_object_or_404(Event, pk=pk) if pk else None
    if not pk and not request.user.has_perm("events.add_event"):
        raise Http404
    initial = {}
    if not event and (city := current_city(request)):
        initial["city"] = city
    form = EventForm(request.POST or None, request.FILES or None, instance=event, initial=initial)
    if request.method == "POST":
        if request.POST.get("action") == "delete" and event and request.user.has_perm("events.delete_event"):
            log(request, event, DELETED, "deleted in Studio")
            title = event.title
            event.delete()
            messages.success(request, f"Deleted {title}.")
            return redirect("studio:events")
        if form.is_valid():
            created = event is None
            obj = form.save()
            log(request, obj, ADDED if created else CHANGED, "saved in Studio")
            messages.success(request, f"{'Created' if created else 'Saved'} {obj.title}.")
            if request.POST.get("action") == "save_continue":
                return redirect("studio:event_edit", pk=obj.pk)
            return redirect(reverse("studio:events") + ("?tab=drafts" if obj.status == "draft" else ""))
        messages.error(request, "Some fields need attention.")
    venues = [{"id": v.pk, "city": v.city_id, "name": v.name} for v in form.fields["venue"].queryset]
    talent_by_city = {}
    for t in form.fields["lineup"].queryset:
        talent_by_city.setdefault(t.city.name, []).append(t)
    cities = {
        c.pk: {"symbol": c.currency_symbol, "provider": c.ticket_provider, "tz": c.timezone, "name": c.name} for c in City.objects.all()
    }
    selected = {int(v) for v in (form["lineup"].value() or []) if str(v).isdigit()}
    return render(
        request,
        "studio/event_form.html",
        {
            "nav": "events",
            "form": form,
            "event": event,
            "venues": venues,
            "cities": cities,
            "talent_by_city": talent_by_city,
            "selected_lineup": selected,
        },
    )


@require_POST
@studio_view("events.change_event")
def event_toggle(request, pk, field):
    event = get_object_or_404(Event, pk=pk)
    if field == "featured":
        event.is_featured = not event.is_featured
        event.save(update_fields=["is_featured", "updated_at"])
        msg = f"{event.title} {'is now on' if event.is_featured else 'is off'} the homepage."
    elif field == "publish":
        event.status = Event.Status.DRAFT if event.status == Event.Status.PUBLISHED else Event.Status.PUBLISHED
        try:
            event.full_clean()
        except ValidationError as exc:
            messages.error(request, f"Can't publish {event.title}: " + " ".join(m for msgs in exc.message_dict.values() for m in msgs))
            return redirect(request.POST.get("back") or "studio:events")
        event.save(update_fields=["status", "updated_at"])
        msg = f"{event.title} {'published' if event.status == 'published' else 'moved to drafts'}."
    else:
        raise Http404
    log(request, event, CHANGED, msg)
    messages.success(request, msg)
    back = request.POST.get("back") or reverse("studio:events")
    if not url_has_allowed_host_and_scheme(back, allowed_hosts={request.get_host()}):
        back = reverse("studio:events")
    return redirect(back)


# ---------------------------------------------------------------- talent


@studio_view("talent.view_talent")
def talent(request):
    group = request.GET.get("group", "")
    qs = scoped(Talent.objects.select_related("city"), request).annotate(
        enquiry_count=Count("enquiries", distinct=True),
        open_count=Count("enquiries", filter=Q(enquiries__status__in=OPEN_STATUSES), distinct=True),
        event_count=Count("events", filter=Q(events__starts_at__gte=timezone.now()), distinct=True),
    )
    if group:
        qs = qs.filter(category__in=[c for c, g in Talent.GROUPS.items() if g == group])
    qs = qs.order_by("-is_featured", "featured_order", "name")
    groups = [{"key": g, "on": g == group} for g in ("DJs", "Live", "Hosts")]
    return render(request, "studio/talent.html", {"nav": "talent", "people": qs, "groups": groups, "group": group})


@studio_view("talent.change_talent")
def talent_edit(request, pk=None):
    person = get_object_or_404(Talent, pk=pk) if pk else None
    initial = {"city": current_city(request)} if not person and current_city(request) else {}
    form = TalentForm(request.POST or None, request.FILES or None, instance=person, initial=initial)
    upload = UploadForm(request.POST or None, request.FILES or None, prefix="m") if person else None
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "upload" and person:
            if upload.is_valid():
                n = _add_media(TalentMedia, {"talent": person}, upload.cleaned_data, person.media.count())
                log(request, person, CHANGED, f"added {n} media")
                messages.success(request, f"Added {n} item(s) to {person.name}.")
            else:
                messages.error(request, " ".join(upload.non_field_errors()) or "Couldn't add that.")
            return redirect("studio:talent_edit", pk=person.pk)
        if action == "delete_media" and person:
            person.media.filter(pk=request.POST.get("media")).delete()
            messages.success(request, "Removed.")
            return redirect("studio:talent_edit", pk=person.pk)
        if form.is_valid():
            created = person is None
            obj = form.save()
            log(request, obj, ADDED if created else CHANGED, "saved in Studio")
            messages.success(request, f"{'Added' if created else 'Saved'} {obj.name}.")
            return redirect("studio:talent_edit", pk=obj.pk)
        messages.error(request, "Some fields need attention.")
    recent = BookingEnquiry.objects.filter(talent=person).order_by("-created_at")[:5] if person else []
    return render(request, "studio/talent_form.html", {"nav": "talent", "form": form, "person": person, "upload": upload, "recent": recent})


@require_POST
@studio_view("talent.change_talent")
def talent_toggle(request, pk, field):
    person = get_object_or_404(Talent, pk=pk)
    attr = {"featured": "is_featured", "published": "is_published", "booking": "booking_available"}.get(field)
    if not attr:
        raise Http404
    setattr(person, attr, not getattr(person, attr))
    person.save(update_fields=[attr, "updated_at"])
    log(request, person, CHANGED, f"{attr} → {getattr(person, attr)}")
    return redirect(request.POST.get("back") or "studio:talent")


def _add_media(model, owner, data, start):
    n = 0
    for i, image in enumerate(data.get("photos") or []):
        model.objects.create(**owner, kind=MediaKind.PHOTO, image=image, caption=data.get("caption", ""), order=start + i + 1)
        n += 1
    if data.get("video_url"):
        model.objects.create(
            **owner, kind=MediaKind.VIDEO, video_url=data["video_url"], caption=data.get("caption", ""), order=start + n + 1
        )
        n += 1
    return n


# ---------------------------------------------------------------- gallery


@studio_view("gallery.view_album")
def gallery(request):
    albums = scoped(Album.objects.select_related("city", "event"), request).annotate(n=Count("items")).order_by("-date", "-id")
    return render(request, "studio/gallery.html", {"nav": "gallery", "albums": albums})


@studio_view("gallery.change_album")
def album_edit(request, pk=None):
    album = get_object_or_404(Album, pk=pk) if pk else None
    initial = {"city": current_city(request), "date": timezone.localdate()} if not album else {}
    form = AlbumForm(request.POST or None, request.FILES or None, instance=album, initial=initial, prefix="a")
    upload = UploadForm(request.POST or None, request.FILES or None, prefix="m") if album else None
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "upload" and album:
            if upload.is_valid():
                n = _add_media(AlbumItem, {"album": album}, upload.cleaned_data, album.items.count())
                log(request, album, CHANGED, f"added {n} items")
                messages.success(request, f"Added {n} item(s) to {album.title}.")
            else:
                messages.error(request, " ".join(upload.non_field_errors()) or "Couldn't add that.")
            return redirect("studio:album_edit", pk=album.pk)
        if action == "delete_item" and album:
            album.items.filter(pk=request.POST.get("item")).delete()
            messages.success(request, "Removed from the album.")
            return redirect("studio:album_edit", pk=album.pk)
        if form.is_valid():
            created = album is None
            obj = form.save()
            log(request, obj, ADDED if created else CHANGED, "saved in Studio")
            messages.success(request, f"{'Created' if created else 'Saved'} {obj.title}." + (" Now add some photos." if created else ""))
            return redirect("studio:album_edit", pk=obj.pk)
        messages.error(request, "Some fields need attention.")
    return render(
        request,
        "studio/album_form.html",
        {"nav": "gallery", "form": form, "album": album, "upload": upload, "items": album.items.all() if album else []},
    )


# ---------------------------------------------------------------- shop


@studio_view("shop.view_product")
def shop(request):
    products = Product.objects.prefetch_related("prices__city", "variants").order_by("order", "name")
    city = current_city(request)
    if city:
        products = products.filter(prices__city=city).distinct()
    return render(request, "studio/shop.html", {"nav": "shop", "products": products})


@studio_view("shop.change_product")
def product_edit(request, pk=None):
    product = get_object_or_404(Product, pk=pk) if pk else None
    form = ProductForm(request.POST or None, request.FILES or None, instance=product, prefix="p")
    prices = PriceFormSet(request.POST or None, instance=product or Product(), prefix="price")
    variants = VariantFormSet(request.POST or None, instance=product or Product(), prefix="var")
    if request.method == "POST":
        if form.is_valid() and prices.is_valid() and variants.is_valid():
            created = product is None
            obj = form.save()
            prices.instance = variants.instance = obj
            prices.save()
            variants.save()
            log(request, obj, ADDED if created else CHANGED, "saved in Studio")
            messages.success(request, f"{'Added' if created else 'Saved'} {obj.name}.")
            return redirect("studio:product_edit", pk=obj.pk)
        messages.error(request, "Some fields need attention.")
    return render(
        request, "studio/product_form.html", {"nav": "shop", "form": form, "prices": prices, "variants": variants, "product": product}
    )


# ---------------------------------------------------------------- content


@studio_view("core.change_faq")
def content(request):
    site = SiteSettings.load()
    site_form = SiteSettingsForm(request.POST if request.POST.get("action") == "site" else None, instance=site, prefix="s")
    faqs = FAQFormSet(request.POST if request.POST.get("action") == "faqs" else None, prefix="f")
    if request.method == "POST":
        if request.POST.get("action") == "site" and site_form.is_valid():
            site_form.save()
            log(request, site, CHANGED, "site settings")
            messages.success(request, "Site settings saved.")
            return redirect("studio:content")
        if request.POST.get("action") == "faqs" and faqs.is_valid():
            faqs.save()
            messages.success(request, "FAQs saved.")
            return redirect(reverse("studio:content") + "#faqs")
        messages.error(request, "Some fields need attention.")
    cities = City.objects.annotate(
        n_events=Count("events", filter=Q(events__starts_at__gte=timezone.now()), distinct=True),
        n_talent=Count("talent", distinct=True),
    )
    return render(request, "studio/content.html", {"nav": "content", "site_form": site_form, "faqs": faqs, "cities_list": cities})


# ---------------------------------------------------------------- search


@studio_view()
def search(request):
    q = request.GET.get("q", "").strip()
    results = []
    if len(q) >= 2:
        for e in Event.objects.filter(Q(title__icontains=q) | Q(venue__name__icontains=q)).select_related("city")[:6]:
            results.append(
                {
                    "type": "Event",
                    "title": e.title,
                    "sub": f"{e.local_starts_at:%d %b %Y} · {e.city}",
                    "url": reverse("studio:event_edit", args=[e.pk]),
                }
            )
        for t in Talent.objects.filter(Q(name__icontains=q) | Q(genre__icontains=q)).select_related("city")[:6]:
            results.append(
                {
                    "type": "Talent",
                    "title": t.name,
                    "sub": f"{t.get_category_display()} · {t.city}",
                    "url": reverse("studio:talent_edit", args=[t.pk]),
                }
            )
        for r in _enquiry_rows(request, q=q)[:8]:
            results.append(
                {
                    "type": "Enquiry",
                    "title": f"{r['obj'].reference} · {r['name']}",
                    "sub": r["title"],
                    "url": reverse("studio:enquiries") + f"?status=all&open={r['key']}",
                }
            )
        for a in Album.objects.filter(title__icontains=q)[:4]:
            results.append({"type": "Album", "title": a.title, "sub": str(a.city), "url": reverse("studio:album_edit", args=[a.pk])})
    return render(request, "studio/search.html", {"nav": "", "q": q, "results": results})
