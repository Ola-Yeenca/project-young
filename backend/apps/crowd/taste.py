"""Crowd taste: which events take answers, the genre choices, and what the room wants."""

import re
from collections import Counter
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.core.models import MusicStyle, normalize_catalog_name
from apps.events.models import Event
from apps.radio.models import Track

from .models import TasteAnswer

MAX_GENRES = 3
OPEN_AFTER_START = timedelta(hours=12)
DASHES = re.compile(r"\s*[-‐‑‒–—―]\s*")


def closes_at(event):
    end = event.starts_at + OPEN_AFTER_START
    return max(end, event.ends_at) if event.ends_at else end


def is_open(event):
    return event.status == Event.Status.PUBLISHED and timezone.now() <= closes_at(event)


def is_live(event):
    return event.status == Event.Status.PUBLISHED and event.starts_at <= timezone.now() <= closes_at(event)


def _label(slug):
    return dict(Event.Style.choices).get(slug) or dict(Track.Genre.choices).get(slug) or slug.replace("-", " ").title()


def genre_options(event):
    """(slug, name) pairs from the music style catalog, the event's own style first.

    With an empty catalog the event's style and the HOY Radio genres stand in.
    """
    options = list(MusicStyle.objects.values_list("slug", "name"))
    if not options:
        options = [(event.music_style, _label(event.music_style)), *Track.Genre.choices]
    out, seen = [], set()
    for slug, name in [o for o in options if o[0] == event.music_style] + options:
        if slug and slug not in seen:
            seen.add(slug)
            out.append((slug, name))
    return out


def genre_shares(genre_lists, names=None):
    """Each genre's share of the answers that picked any genre, most picked first."""
    names = names or {}
    picks = [set(g) for g in genre_lists if g]
    counts = Counter(slug for p in picks for slug in p)
    rows = [
        {"slug": slug, "name": names.get(slug) or _label(slug), "count": n, "percent": round(n * 100 / len(picks))}
        for slug, n in counts.items()
    ]
    return sorted(rows, key=lambda r: (-r["count"], r["name"]))


def summary(event):
    """The public view of an event's answers: genre choices and shares only, never free text."""
    options = genre_options(event)
    genre_lists = list(event.taste_answers.values_list("genres", flat=True))
    return {
        "open": is_open(event),
        "closes_at": closes_at(event),
        "options": [{"slug": slug, "name": name} for slug, name in options],
        "total": len(genre_lists),
        "genres": [{k: r[k] for k in ("slug", "name", "percent")} for r in genre_shares(genre_lists, dict(options))],
    }


def save_answer(event, visitor, source, **fields):
    """One answer per event, visitor and source; sending again replaces it."""
    with transaction.atomic():
        answer, created = TasteAnswer.objects.select_for_update().get_or_create(
            event=event, visitor=visitor, source=source, defaults={"city_id": event.city_id, **fields}
        )
        if not created:
            if text_key(answer.song) != text_key(fields.get("song", "")):
                answer.song_hidden = False
            for name, value in fields.items():
                setattr(answer, name, value)
            answer.save()
    return answer, created


def text_key(value):
    """Groups free text regardless of case, spacing and the kind of dash ("Artist – Title")."""
    return normalize_catalog_name(DASHES.sub(" - ", value or ""))


def top_texts(values, limit=10):
    """Free text grouped by text_key, shown in its most common spelling."""
    counts, spellings = Counter(), {}
    for value in values:
        key = text_key(value)
        if key:
            counts[key] += 1
            spellings.setdefault(key, Counter())[value] += 1
    return [{"key": key, "name": spellings[key].most_common(1)[0][0], "value": n} for key, n in counts.most_common(limit)]


def song_requests(answers, limit=40):
    """Visible song requests, most recent first, with repeats folded into a count."""
    rows = {}
    for a in sorted(answers, key=lambda a: a.updated_at, reverse=True):
        key = text_key(a.song)
        if not key or a.song_hidden:
            continue
        if key in rows:
            rows[key]["count"] += 1
        else:
            rows[key] = {"key": key, "song": a.song, "count": 1, "at": a.updated_at}
    return list(rows.values())[:limit]
