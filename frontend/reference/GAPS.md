# House of Young public site: gap list

Source of truth: `reference/prototype.html` (copy of `prototype/index.html`, 881 lines).
Stack: Next.js (App Router) + TypeScript. The prototype CSS is ported verbatim into `app/globals.css`.

## Baseline

There is no existing public frontend to diff against. The only connected piece is
`backend/static/hoy/live-content.js`: a DEBUG-only `/preview/` adapter that patches
events and gallery into the unmodified prototype. It is a data-mapping reference, not
a base to build on. So every row below starts as **lacks**. The Status column is
updated to **done** only after it has been checked visually.

Legend: `lacks` = not built yet · `differs` = built but not identical · `done` = matches and verified · `drop` = prototype-only, intentionally removed.

## 1. Design system (prototype L13–L110, L394–L399)

| # | Item | Prototype ref | Status |
|---|------|---------------|--------|
| 1.1 | `:root` light tokens (bg, ink, line, gold, night, live, fonts, `--ease`, `--snap`) | L13–22 | lacks |
| 1.2 | Dark tokens under `prefers-color-scheme:dark` + `:not([data-theme=light])`, and `[data-theme=dark]` | L23–30 | lacks |
| 1.3 | Fonts: Geist 300–900, Geist Mono 400/500, Instrument Serif italic (self-hosted via `next/font/google`, same families/weights) | L7 | lacks |
| 1.4 | Base reset (body flex column, h1–h3 balance, links, buttons, canvas block) | L32–39 | lacks |
| 1.5 | `.mono`, `.it`, `:focus-visible` gold ring | L40–42 | lacks |
| 1.6 | `.app` container `app / inline-size` root wrapper (full width, no phone frame) | L52 | lacks |
| 1.7 | `.wrap` (1240 / 20→40px), `.blk` (56→104px) | L60–66 | lacks |
| 1.8 | View enter animation `viewin .6s` on each route | L62–64 | lacks |
| 1.9 | `.grain::after` with generated 140×140 noise as `--noise`, `steps(5)` jitter | L67–69, L599 | lacks |
| 1.10 | `[data-rv]` scroll reveal: `.pre` → `.seen`, `--d` delays, IO rootMargin `-6%`, in-view items skip | L71–73, L685–688 | lacks |
| 1.11 | `.wd` word rise, `--i*80ms+80ms`, `words()` keeps `.it` span as one word | L130–132, L703 | lacks |
| 1.12 | `.btn` slide-up fill, `.btn.ink` gold fill, `.btn.sm`, `.ar` nudge | L76–85 | lacks |
| 1.13 | `.mag` magnetic pull (mouse only, 0.22/0.30, off under RM) | L86, L830–833 | lacks |
| 1.14 | Container query breakpoints 520/600/760/860/900/960/1000/1100 (prompt lists six; prototype also uses 600 for `.f2` and 960 for `.night .wrap`, ported as-is) | various | lacks |
| 1.15 | Reduced motion: CSS block + every `RM` branch in JS (slow spin 40s, no marquee, no ripples when idle, countUp instant, no drift/parallax, no wipe, no SVG dot) | L394–399, JS | lacks |
| 1.16 | `.swap` fade-up children `--i*60ms+200ms` | L138–139 | lacks |

## 2. Header (L88–110, L410–419)

| # | Item | Status |
|---|------|--------|
| 2.1 | Sticky translucent header, `color-mix 82%`, `saturate(1.4) blur(14px)` | lacks |
| 2.2 | HOY round mark, `rotate(360deg)` on hover `.8s` | lacks |
| 2.3 | Word mark `.w` from 520px | lacks |
| 2.4 | `nav.top` from 860px; underline scales in from left, out to right; `.on` for active route | lacks |
| 2.5 | Live clock from 1000px, `{City} HH:MM:SS`, green dot `live` pulse | lacks |
| 2.6 | City switch generated from `/cities/`, knob measured to the active button (`offsetLeft-3`, width), springy `cubic-bezier(.7,-.3,.2,1.3)`, re-measured on resize and `fonts.ready` | lacks |

## 3. Home: turntable hero (L112–190, L423–451, JS L601–659, L746–770)

| # | Item | Status |
|---|------|--------|
| 3.1 | `.hero.grain`, `.glow` radial (`150cqw`), 3-col grid from 900px (`1fr minmax(0,520px) 1fr`, min-height 640) | lacks |
| 3.2 | Mobile order: platter(1) → notes(2) → buy(3) | lacks |
| 3.3 | `.notes`: kicker with 4 eq bars + "Now spinning/playing · City"; h1 with words rising, last word italic gold; `.kv` Date/Doors/Venue/Line-up (serif italic) | lacks |
| 3.4 | Line-up names with a `slug` link to the talent sheet | lacks (prototype has plain text; additive per prompt) |
| 3.5 | `record()` canvas 900px: clipped disc, poster drawn as the base art (the `field()` palette is used as the fallback), grooves, three highlight rings, light streak, rim, grain | lacks |
| 3.6 | Platter `drop` 1.3s intro; tonearm SVG drops at 700ms (`.on`), `.deep` while playing, `.lift` on record change | lacks |
| 3.7 | Label button: N° · BPM, title, Play/Stop pill (triangle → pause bars), hover scale 1.06; hint fades out while playing | lacks |
| 3.8 | Physics `T`: idle 360°/12s (40s under RM), playing 33⅓ rpm, easing 260/900ms, drag via pointer angle, momentum release | lacks |
| 3.9 | Hold to muffle: low-pass to 420 Hz on pointerdown, back to 18 kHz on release; scratch noise bursts while dragging | lacks |
| 3.10 | WebAudio `A`: master .55 → compressor, low-pass, noise buffer, tanh curve; `kick hat clap logdrum conga bell`, `PAT.afro`/`PAT.piano`, swing 0.92/1.08, 25ms scheduler, 120ms lookahead | lacks |
| 3.11 | Tempo = `bpm` (default 104); `music_style==="amapiano"` → piano, else afro; `retune()` on record change; audio only after a tap | lacks |
| 3.12 | Beat visuals: pulse ring opacity/scale, bar ripples (idle: every 4 beats at .45 unless RM), glow breathing, disc scale 1.012, eq heights | lacks |
| 3.13 | Side discs from 1100px with vertical `NN — Title`, hover translate+rotate, click = step ±1 | lacks |
| 3.14 | Pager: ← dots → and `NN / NN`; active dot 34px with 9s gold progress, `.hold` while playing | lacks |
| 3.15 | Auto-advance every 9s while idle; pauses while playing, sheet open, or off Home; idle is reset by click, keydown, wheel, pointerdown | lacks |
| 3.16 | Record change cross-fades a new canvas `.next` → `.in` over .7s, `T.v += .25` | lacks |
| 3.17 | `countUp` price (900ms cubic-out), `0 → "Free"`, "Tickets from"/"Entry" label | lacks |
| 3.18 | Sold meter fill (1.2s snap) + counted `% sold`; `sold_out` → "Sold out · waitlist open" | lacks |
| 3.19 | Buy button: `ticket_url` new tab, `Buy on {provider} ↗`, sold out → "Join waitlist"; `is_cancelled` → hidden, show "Cancelled" | lacks |
| 3.20 | "Event details" → event sheet; caption `.cap` re-animates on change | lacks |
| 3.21 | Keyboard on Home: ← → step, Space play/stop (not inside form fields) | lacks |
| 3.22 | Now-playing state drives `.np` pill text `{title} · {bpm} BPM` | lacks |
| 3.23 | Empty state: label shows city name, title "New dates soon"; skeleton grey disc while loading | lacks |

## 4. Home: below the hero (L192–282, L453–466, JS L661–682)

| # | Item | Status |
|---|------|--------|
| 4.1 | Marquee `.mq`: titles (filled) ✦ date ✦ … city ✦, doubled; speed `.045 + min(1.4, |sv|*.02)` px/ms with `.9` decay; direction follows scroll; hover fills outlines; ✦ spins | lacks |
| 4.2 | `.cities`: two cards + `.link` dashed curved SVG, gold dot travelling the path (`animateMotion` 3.6s, reversed per city, hidden under RM), endpoint dots gold for the selected city | lacks |
| 4.3 | City card: live `HH:MM:SS` (seconds muted), "Next: **title** · date", `provider · CUR`, `.on` state (the "you are here" state), hover fill rising from the bottom, h3 nudge; click → switch city | lacks |
| 4.4 | Distance `km` + "Nh apart" under the link | lacks (see A1) |
| 4.5 | "The calendar" `.idx` with header row from 760px, `.row` clip-path ink fill, Selling fast (blinking dot) / Sold out tags | lacks |
| 4.6 | Peek: 210px 4:5 card follows cursor (+140px), lerp .16, tilt from velocity ±14°, image zoom 1.14→1, hidden on `hover:none` | lacks |
| 4.7 | Line-up `.night.grain` band, intro + chips All/DJs/Live/Hosts, "Full roster →", names with per-letter gold roll-up, siblings dim .28, sup DJ/LIVE/HOST, peek on names | lacks |
| 4.8 | "From the floor" `.strip` 8 frames: drift `.025px/ms` looping, pauses on hover/drag, parallax ±7%, mouse drag-to-scroll, play badge for video | lacks |

## 5. Pages

| # | Page | Item | Status |
|---|------|------|--------|
| 5.1 | /events | "Events in *City*", "Tickets via {provider}", kind chips (from data), upcoming idx, "Past" idx with "Recap" | lacks |
| 5.2 | /talent | Full line-up on the night band (no h2, no "Full roster" button) | lacks |
| 5.3 | /gallery | "Gallery" / "Drag or swipe", album chips (All + album titles), strip of real items (photos, video with play badge) | lacks |
| 5.4 | /shop | `.focus` 3-col: kv Material/Fit/Ships, round `.obj` image with HOY mark, N° x/y, name, counted price, sizes from `variants` (out of stock disabled), pager + dots `.hold`, caption | lacks |
| 5.5 | /shop | "Add to bag" becomes `Buy ↗` → `prices[0].checkout_url` (per prompt) | lacks |
| 5.6 | /contact | `.big` line words rising, About from `/site/`, WhatsApp pill, FAQ from `/faqs/`, form with reason chips | lacks |
| 5.7 | /events/:slug, /talent/:slug, /gallery/:slug | Open as sheets over the current page (intercepting routes); direct load renders the underlying page with the sheet open | lacks |

## 6. Global

| # | Item | Status |
|---|------|--------|
| 6.1 | City wipe: gold clip-path in 520ms, inner text slides from -10% (700ms), data swaps at 900ms, out 560ms; subline `HH:MM local · tickets via X`; skipped under RM | lacks |
| 6.2 | Sheet: dim fade, card slides from right (500px), Ken Burns 12s, gradient, overlay stagger, ✕ rotates 90°, Esc and dim close, `body` padding staggers | lacks |
| 6.3 | Event sheet: tag, title, `date · time · venue`, Buy/waitlist, RSVP 3-way with springy knob (local state only, no API), caption, kv Line-up/Venue/Doors/Tempo/Tickets/Age (`age_restriction`) | lacks |
| 6.4 | Talent sheet: photo, tag group, name, `genre · city`, bio, kv Previous/Based/Reply, links from `links[]`, booking form | lacks |
| 6.5 | Mobile `.dock` sticky: `.np` sits above `.tabs` (`bottom: calc(100% + 12px)`), 5 tabs with spring icons and gold indicator, hidden from 860px. **Regression guard: np never behind tabs.** | lacks |
| 6.6 | Footer: `© {year} House of Young · Valencia · Lagos` (cities from API), legal links, "Powered by SME Analytica" only if `show_powered_by` | lacks |
| 6.7 | Theme: honour `data-theme` on `<html>` (no toggle in prototype → none added) | lacks |

## 7. Forms

| # | Item | Status |
|---|------|--------|
| 7.1 | Contact POST `/enquiries/contact/`: name, email, phone, message, subject (first line or "Website enquiry"), city, category from chip, `privacy_accepted`, honeypot `website` | lacks |
| 7.2 | Booking POST `/enquiries/booking/`: talent, client_name, company, email, phone, event_date, event_location, event_type, expected_audience, message, privacy, honeypot | lacks |
| 7.3 | Success → `.sent` with `Received · {reference}`; 400 → inline field errors; 429 → "Too many messages, try again later" | lacks |
| 7.4 | Privacy checkbox styled in the form's mono label style | lacks |

## 8. Dropped (prototype-only)

`.proto` bar, Admin notes, Desktop/Phone toggle, `.stage.phone` frame, every `.ops` box, hash routing, sample `D`, `field()`/`PAL` as primary imagery (kept only as the missing-image fallback). The shop "Phase 3" ops note goes too.

## 9. API reality vs. the prompt's mapping (checked against `backend/api/`)

| # | Finding | Plan |
|---|---------|------|
| A1 | `/cities/` has **no lat/lng**, so the prototype's km distance can't be computed from data | Small slug → coordinates table in the frontend, used only for the `.link` caption; omit km if a city isn't in it. Alternative: add `lat`/`lng` to City (backend change, your call) |
| A2 | **No CORS is configured** in `config/settings.py` (no `corsheaders`, no `CORS_ALLOWED_ORIGINS`) | Next.js rewrites `/api/v1/*` → `API_URL`, so the browser stays same-origin and no CORS is needed. Server components fetch `API_URL` directly |
| A3 | Event `kind` is a slug (`club`, `live`, `day`, `festival`, `talk`, `private`), not "Club" | Label map → `Club / Live / Day / Festival / Talk / Private` |
| A4 | Lists are paginated (`PageNumberPagination`, 50) | Follow `next` like `live-content.js` does |
| A5 | City has `currency` + `currency_symbol` (EUR/NGN) | Shop header `EUR · ships from Valencia` built from those |
| A6 | `poster_fit` = contain/cover | Honoured in the sheet hero; the record label art always covers |
| A7 | The prototype booking form has one "Email or phone" field; the API needs `client_name`, `company`, `email`, `phone` | Adds rows in the same `.f2` style. Layout grows by about two rows, which is a necessary difference |
| A8 | `event_type` includes `festival`, which the prototype `<select>` lacks | Added |
| A9 | Gallery "All" strip needs items from every album | Fetch `/gallery/:slug/` per album (server side, cached), interleave |
| A10 | `backend/apps/ticketing/` is untracked, in-progress work in the backend | Not touched |

## 10. Open questions (defaults I'll use unless you say otherwise)

1. **Legal links** (Privacy · Legal notice · Terms): no pages or URLs exist. Default: `/privacy`, `/legal`, `/terms` as simple text pages fed from nothing yet. They render a "coming soon" line, and the contact privacy checkbox links to `/privacy`.
2. **City persistence**: the selected city lives in a cookie (`hoy_city`) so server components fetch the right city. The default is the first city from `/cities/`.
3. **Lighthouse ≥ 85 mobile** with a 900px canvas, WebAudio code and grain animation: the audio and physics code is loaded only when the hero is on screen, and the record canvas is drawn after first paint.
