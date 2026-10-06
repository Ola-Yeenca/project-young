# Prompt: build the House of Young website exactly like the prototype

Paste everything below the line into Claude Code, opened in the frontend repo.
First copy `prototype/index.html` from the `project-young` repo into the
frontend repo as `reference/prototype.html`, so Claude can read it and open it
next to your build.

---

You are rebuilding the House of Young public website so that it matches the
approved prototype **exactly**: the same look, layout, spacing, type, colours,
motion and interactions. The prototype is `reference/prototype.html`. It is one
self-contained file (HTML, CSS in `<style>`, JS in `<script>`), and it is the
single source of truth. When this prompt and the prototype disagree, the
prototype wins. If something exists in the current frontend but not in the
prototype, it goes, unless it is in the "Keep" list below.

Data comes from the House of Young Django API (`/api/v1/`), not the sample
data in the prototype.

## How to work

1. **Read the whole prototype first**: all of the CSS, all of the markup and
   all of the JS. Don't skim it. Then read the current frontend.
2. **Write a gap list** (`reference/GAPS.md`): every component, style rule,
   animation and interaction in the prototype, and whether the current frontend
   has it exactly, has it differently, or lacks it. Show me the list before
   you change code.
3. **Port, don't reinterpret.** Copy the CSS custom properties and rules over
   as written: the same values, easing curves, durations, `clamp()` sizes,
   radii and breakpoints. Don't round values, swap in Tailwind or UI-kit
   defaults, change fonts, "improve" spacing or add effects of your own. If
   the project uses Tailwind or CSS modules, put the prototype's CSS in a
   global stylesheet (or modules with the same values). Don't translate it
   into approximate utility classes.
4. **Keep the existing framework and routing** of the frontend repo. Turn the
   prototype's string templates and `$()` DOM code into components, but keep
   the class names and DOM structure, so the CSS applies unchanged.
5. **Verify visually** (see "Done means") before saying anything is finished.

## Remove from the prototype (prototype-only)

- The top `.proto` bar: the "Admin notes" toggle, the Desktop/Phone toggle and
  the `.stage` phone frame. The site renders full width.
- The `.ops` "How the team runs this" boxes.
- Hash routing (`#events`). Use real routes instead: `/`, `/events`,
  `/events/:slug`, `/talent`, `/talent/:slug`, `/gallery`, `/gallery/:slug`,
  `/shop`, `/contact`. The detail sheets open on top of the current page and
  update the URL, so detail pages can be shared and opened directly.
- The canvas-generated stand-in images (`field()`, `PAL`). Use the real
  `poster`, `photo`, `cover` and `image` URLs. Keep `field()` only as the
  fallback when an image is missing.
- The hardcoded sample data `D`.

## Keep exactly (checklist)

**Design system**
- Every `:root` token, light and dark. The dark palette is used under
  `prefers-color-scheme: dark` unless `data-theme="light"`, and also when
  `data-theme="dark"`.
- Fonts: Geist (300–900), Geist Mono, Instrument Serif italic, loaded from
  Google Fonts or self-hosted.
- `.mono` labels, `.it` serif italic accents, `.btn` (with the fill that slides
  up on hover, the gold fill on `.btn.ink` and the arrow nudge), `.mag` magnetic
  buttons, `:focus-visible` ring.
- Grain overlay (`.grain::after`, generated noise texture), view enter
  animation, `[data-rv]` scroll reveals with `--d` delays, and word-by-word
  heading rise (`.wd`).
- Breakpoints. They are container queries on `.app` at **520, 760, 860, 900,
  1000 and 1100px**. Keep a root wrapper with `container: app / inline-size`,
  so every query works unchanged.

**Header**
- Sticky, translucent and blurred. The round "HOY" mark spins 360° on hover.
  The word mark appears from 520px.
- Top nav from 860px, with an underline that draws in from the left and
  retracts to the right.
- Live clock for the current city from 1000px, with the green live dot.
- City switch (Valencia / Lagos, generated from `/api/v1/cities/`, so new
  cities appear automatically). It has a sliding knob on a springy curve
  `cubic-bezier(.7,-.3,.2,1.3)`.

**Home: the turntable hero**
- Three columns from 900px: notes (`.notes`: kicker with eq bars, title
  with words rising, line-up key/value list), platter in the middle, and price
  and actions on the right. A single column on mobile, in the same order as the
  prototype.
- Record drawn on a canvas (`record()`) with the event's poster as the label
  art. The tonearm drops in on load. The label button plays and stops, and the
  hint text appears under it.
- Turntable physics (`T`, `frame()`): steady spin, drag to scratch with
  momentum, and holding the record muffles the audio (low-pass filter).
- **Live groove synthesis with WebAudio** (`A`, `PAT`, `schedule()`, `kick`,
  `hat`, `clap`, `logdrum`, `conga`, `bell`). Tempo comes from the event's
  `bpm`. Pattern: `music_style` `amapiano` → the prototype's `piano` pattern,
  everything else → `afro`. Audio starts only after a tap.
- Beat-synced visuals: pulse ring, ripples, the glow breathing with the beat,
  and the eq bars moving.
- Side discs (from 1100px) peek in from the edges and step to the previous or
  next event. The pager has arrows and dots. It auto-advances every 9 seconds
  (`AUTO`) while idle, and changing the record cross-fades the disc canvas.
- Price uses a count-up (`countUp`). `0` → "Free". The sold meter fills from
  `sold_percent`. "Buy tickets" opens `ticket_url` in a new tab.
  "Event details" opens the event sheet.
- Show "Sold out" or "Selling fast" (≥70%) tags the way `row()` does.

**Home: below the hero**
- Marquee (`.mq`) of event titles and dates, plus the city name. It speeds up
  with scroll velocity and flips direction with scroll direction.
- Two city cards (`.cities`) linked by the dashed curved SVG path. Each card
  has a live local time, the next event and a "you are here" state for the
  selected city. Clicking a card switches city.
- "The calendar" index list (`.idx`) with the cursor-following image peek, which
  has inertia (`PK`, `peeks()`).
- Line-up on the dark `.night` band, with group filter chips (All / DJs /
  Live / Hosts).
- "From the floor" film strip (`.strip`) with slow drift and parallax, plus
  drag or swipe.

**Other pages**
- **Events:** "Events in *City*", "Tickets via {provider}", kind filter chips,
  upcoming index, then Past.
- **Talent:** the full line-up on the night band.
- **Gallery:** album chips and the strip.
- **Shop:** the product view from `renderShop()`, with sizes, material/fit,
  price in the city currency and a buy link to `checkout_url`.
- **Contact:** the big line with words rising, the About text, WhatsApp pill
  for the city, the FAQ `<details>` and the contact form with reason chips.

**Global**
- City switch: the full-screen gold wipe (`.wipe`) shows the city name in huge
  type with a mono subline. The data swaps underneath, then the wipe exits.
- Detail sheets (`.sheet`) slide in from the right over a dimmed page.
  - The hero image has a Ken Burns zoom, a gradient and the overlay text
    staggering in. The close button rotates on hover.
  - The event sheet has the RSVP segmented control with its sliding knob, and
    links.
  - The talent sheet has the bio, previous work, links and the booking form.
- Mobile dock: the sticky `.dock` wrapper holds the bottom tab bar (hidden from
  860px), with icon springs and a gold indicator. The now-playing pill (`.np`:
  spinning vinyl, eq and stop button) sits **above** the tab bar, never behind
  it. This was a bug once, so don't regress it.
- Footer: "© House of Young · Valencia · Lagos", legal links and
  "Powered by SME Analytica" (only if `site.show_powered_by`).
- Reduced motion: follow the prototype's
  `@media (prefers-reduced-motion: reduce)` rules and `RM` checks, so motion
  softens rather than disappears. Audio still works.

## Data mapping (prototype → API)

Base URL comes from an env var (`VITE_API_URL` / `NEXT_PUBLIC_API_URL`, for
example `https://api.houseofyoung.com/api/v1`). Every list takes `?city=<slug>`.

| Prototype | API |
|---|---|
| `D[city]` label, `tz`, `cur`, `wa`, `prov` | `GET /cities/` → `name`, `timezone`, `currency_symbol`, `whatsapp_number`, `ticket_provider` |
| `events` (turntable + calendar) | `GET /events/?city=` (upcoming). Turntable: `&featured=1`, falling back to the upcoming list if empty |
| `e.t`, `e.d`, `e.time`, `e.v` | `title`, `local.date`, `local.time`, `venue.name` |
| `e.p`, `e.sold`, `e.kind`, `e.cap` | `price_from` (`is_free`), `sold_percent` (`sold_out`), `kind`, `caption` |
| `e.lu`, `e.bpm`, `e.style` | `lineup[].name` (link to the talent sheet when `slug`), `bpm` (default 104), `music_style` |
| Buy tickets | `ticket_url`. Hide it when `is_cancelled` and show "Cancelled" |
| `past` | `GET /events/?city=&when=past` |
| `talent` | `GET /talent/?city=` (`name`, `genre`, `group`, `photo`). The sheet uses `GET /talent/:slug/` (`bio`, `previous_work[]`, `links[]`, `media[]`, `upcoming_events`) |
| `albums`, strip | `GET /gallery/?city=` (`title`, `cover`), then `GET /gallery/:slug/` → `items[]` (`kind`, `image`, `video_url`, `caption`) |
| `products` | `GET /products/?city=` → `name`, `material`, `fit`, `variants[]` (`label`, `in_stock`), `prices[0]` (`amount`, `currency_symbol`, `checkout_url`), `images[]` |
| FAQ | `GET /faqs/` (replaces the hardcoded `<details>`) |
| About text, socials, powered-by | `GET /site/` → `about`, `tagline`, `instagram_url`, `tiktok_url`, `youtube_url`, `show_powered_by` |

**Forms.** These POST JSON. On success, show the returned `reference` (for
example `HOY-BK-260001`) in the prototype's success state. On 400, show field
errors inline. On 429, show "Too many messages, try again later".

- Contact form: `POST /enquiries/contact/` with `name`, `email`, `phone`,
  `message`, `subject` (use the first line of the message, or "Website
  enquiry"), `city`, `privacy_accepted: true`, `website: ""`. Add a privacy
  checkbox styled like the form. Map the reason chips to `category`:
  - General → `general`
  - Talent booking → `talent`
  - Collaboration → `collaboration`
  - Business → `business`
  - Press → `press`
  - Other → `other`
- Booking form (talent sheet): `POST /enquiries/booking/` with `talent`
  (slug), `client_name`, `company`, `email`, `phone`, `event_date`,
  `event_location`, `message`, `privacy_accepted`, `website: ""`, and these two
  choice fields:
  - `event_type`: `concert`, `club`, `private`, `corporate`, `wedding`,
    `festival` or `other`
  - `expected_audience`: `lt100`, `100-300`, `300-1000` or `gt1000`
- `website` is a honeypot. Render it as a visually hidden input that nobody
  fills, exactly as named.

The API sends CORS headers for the origins in its `CORS_ALLOWED_ORIGINS`.
Locally, `http://localhost:3000` and `http://localhost:5173` are allowed.

Loading and empty states: use skeletons in the same shapes (a grey disc, grey
rows). With no events, the turntable shows the city's name on the label and
"New dates soon" in place of the title.

## Done means

- The gap list is complete and every item is closed.
- **Side-by-side screenshots** of `reference/prototype.html` and the build,
  using Playwright, at **390×844, 768×1024, 1280×800 and 1440×900**, in
  **light and dark**, for Home, Events, Talent (with the sheet open), Gallery,
  Shop and Contact. Feed the build the same sample content as the prototype,
  through a mocked API or a fixture. Fix differences until they are not
  noticeable. Save the screenshots in `reference/screens/`.
- Manual interaction check, with a short note of each:
  - Play and stop, scratch, and hold to muffle.
  - Auto-advance, and the side discs.
  - City wipe.
  - Marquee reacting to scroll.
  - The peek on the index list.
  - Strip drift.
  - Sheets opening and closing.
  - The now-playing pill visible above the tabs on mobile.
  - Both forms submitting to a local API and showing the reference.
- Lighthouse performance ≥ 85 on mobile, accessibility ≥ 95. Images must be
  lazy-loaded with `width`/`height` set, so the layout doesn't shift.
- No console errors. Lint and typecheck pass.

Work in small commits, one per area (tokens/base, header, hero/turntable,
audio, home sections, pages, sheets, forms, verification), and tell me after
each area what now matches and what still differs.
