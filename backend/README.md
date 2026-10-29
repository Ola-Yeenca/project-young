# House of Young backend

Django 5.2 LTS backend for the House of Young site: events, talent, gallery, merch,
enquiries and FAQs, managed by the HOY team in the admin and served to the website
through a read-only JSON API. Built from the website brief; the plan is in
`../docs/GO_LIVE_PLAN.md`.

## Run it locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DJANGO_DEBUG=1
python manage.py migrate
python manage.py seed_demo          # optional: the prototype's sample content
python manage.py createsuperuser
python manage.py runserver
```

### Isolated local launch on this Mac

After creating `.venv` and installing the dependencies above, use the launcher
from this checkout. It explicitly selects project-local SQLite and file storage,
console email, and local test scratch instead of inheriting service configuration.

```bash
./scripts/local.sh migrate
./scripts/local.sh seed_demo                 # sample content only, on an empty database
./scripts/local.sh createsuperuser
./scripts/local.sh                           # http://127.0.0.1:8017
./scripts/local.sh test                      # safe local test database
```

This Django server serves Studio, the API and the public coming-soon page. There
is no separate frontend process in this branch. Use `/studio/` for the dashboard;
the public event-discovery frontend still needs to be built for deployment.
`/preview/` is a development-only connected preview: it preserves the standalone
Claude prototype and reads published events and curated gallery items from the
same-origin API. Talent, shop and contact remain sample prototype sections.
The unmodified standalone comparison is in `../prototype/index.html`. If port 8017 is in
use, select another free loopback port with `./scripts/local.sh runserver
127.0.0.1:<port>`; do not stop another project's server.

Studio (team dashboard): http://localhost:8000/studio/ · Advanced admin: http://localhost:8000/admin/ · API: http://localhost:8000/api/v1/

Emails print to the terminal in debug mode.

## HOY Studio

`/studio/` is the day-to-day dashboard for the team. It works on desktop, tablet
(slide-out menu) and phone (bottom tab bar, tables turn into cards), in light and
dark mode.

In production Studio has its own host, `https://studio.fromthehouseofyoung.com/`,
named by `HOY_STUDIO_HOST`: Studio at its root (`/events/`, `/crowd/`, ...), the
admin at `/admin/`, and no API. `/studio/...` and `/admin/...` on the API's host
redirect there. Locally, with the variable unset, both stay at `/studio/` and
`/admin/`, so Studio code builds every link with `{% url %}` or `reverse()` and
never writes `/studio/` itself. `apps/studio/middleware.py` picks the URLs
(`config/studio_urls.py` on the studio host); see `../docs/DEPLOY.md`.

- **Overview**: new enquiries, events in the next 30 days, average tickets sold and
  bookings won, each against the previous period. An upcoming events table with
  sales progress and one-click publish. A "Needs attention" list (enquiries waiting
  over 24 hours, events without a poster or ticket link, drafts about to start), a
  dot chart of enquiries over four weeks (one dot per enquiry), most requested
  talent and recent team activity.
- **Enquiries**: inbox with status tabs, search, a pipeline view, email, WhatsApp and
  call shortcuts, internal notes, owner and status in one place.
- **Events**: poster board with live, draft and sold-out states, homepage star and
  publish toggles. The editor has a live preview card and a publish checklist.
  Times are entered in the event city's local time.
- **Talent, Gallery, Shop, Site & FAQs**: roster with booking counts, drag-and-drop
  photo uploads, per-city prices and checkout links, company copy and FAQs.
- **Cities**: admins add a new city in one form (country fills in currency and time
  zone), manage its venues and see a launch-readiness checklist. A new city stays
  hidden from the public site until it's switched on, but the team can prepare it in
  Studio straight away. Team members can edit cities but not add them.
- **Crowd**: what guests want to hear, from the step after Buy tickets and the QR
  page at the venue. Top genres and artists over 90 days, a live board per event
  (genre shares, artists, song requests with repeats counted, hide for unsuitable
  requests, refreshes every 20 seconds) and a print-ready QR code pointing at
  `HOY_SITE_URL/tonight/<slug>`. The team creates **DJ logins** here; a DJ sees
  Crowd and nothing else, and each password is shown once.
- The city switch at the top filters everything to one city or all of them.
- Every change made in Studio is recorded in the same history as the admin.

The classic Django admin stays available as "Advanced admin" for rare tasks such
as users, permissions and cities.

## What the team manages in the admin

| Brief requirement | Where |
|---|---|
| Add, edit and remove events | Events. Times are typed in the event city's local time. |
| Feature events on the homepage | Events list: tick Featured, set the order |
| Add and manage talent profiles | Talent, with photos and video links inline |
| Feature talent on the homepage | Talent list: tick Featured, set the order |
| Upload and organise photos and videos | Gallery → Albums, with "Add photos" for bulk upload |
| Add and edit merchandise | Shop → Products, with sizes and a price per city |
| Manage incoming enquiries | Enquiries: status, owner and internal notes |
| Update FAQs and company copy | Site & cities → FAQs and Site settings |

Give team members staff access and put them in the **HOY team** group. It can
manage all content and enquiries but not user accounts. The **DJs** group can only
read crowd answers. Both groups' permissions are refreshed on every `migrate`.

## API

All read endpoints are public and read-only. Only published content in active
cities is returned.

| Endpoint | Filters |
|---|---|
| `GET /api/v1/cities/` | |
| `GET /api/v1/events/` and `/events/<slug>/` | `city`, `when=upcoming|past|all`, `featured=1`, `kind` |
| `GET /api/v1/talent/` and `/talent/<slug>/` | `city`, `group=DJs|Live|Hosts`, `category`, `featured=1` |
| `GET /api/v1/gallery/` and `/gallery/<slug>/` | `city`, `event` |
| `GET /api/v1/products/` | `city` returns only that city's prices |
| `GET /api/v1/faqs/`, `/api/v1/site/`, `/api/v1/health/` | |
| `POST /api/v1/enquiries/booking/` | talent booking form |
| `POST /api/v1/enquiries/contact/` | contact form |
| `GET`/`POST /api/v1/events/<slug>/taste/` | crowd music answers |

`/events/<slug>/taste/` answers with the genre choices, each genre's share of the
answers and the total; free text is never public. A `POST` takes
`{token, source: "ticket"|"qr", genres: [≤3 music style slugs], artist, song}`. The
browser's random `token` is stored only as a keyed hash, and sending again with
the same token and source replaces the answer. Answers are open for published
events until 12 hours after doors (or the end time, if later), and rate limited
per visitor IP (read through `apps.core.net`) under `HOY_CROWD_RATE` (default
3000 an hour, since a whole venue can answer at once from one Wi-Fi address).

The enquiry endpoints need `privacy_accepted: true` and an email or a phone
number. They are rate limited per IP (`HOY_ENQUIRY_RATE`, default 10 an hour)
and reject anything that fills the hidden `website` field. A successful post
returns only the reference, e.g. `HOY-BK-260001`. It then emails the team (Site
settings → booking or contact email) and sends the client a confirmation.

## Production

Set the variables in `.env.example`: a secret key, allowed hosts, Studio's host
(`HOY_STUDIO_HOST`), `DATABASE_URL` for Postgres, the S3-compatible bucket for
uploads (Supabase Storage) and SMTP details. The `Dockerfile` runs migrations, creates the first admin from
`DJANGO_SUPERUSER_*` (once) and starts Gunicorn on `$PORT`. `railway.json` sets
up the Railway build and health check. The step-by-step guide, including
Supabase Storage, Porkbun DNS and Resend, is in [`docs/DEPLOY.md`](../docs/DEPLOY.md).

Data retention for GDPR and Nigeria's NDPA: schedule
`python manage.py purge_old_enquiries --months 24` to run monthly.

## Checks

```bash
ruff check . && ruff format --check .
python manage.py makemigrations --check --dry-run
python manage.py test
```

CI runs all of these against Postgres 16, plus `check --deploy`, on every
change under `backend/` (`.github/workflows/backend.yml`).

## Add choices while editing

Studio event editors have **Add city**, **Add venue** and **Add music style**
controls beside their fields. The dialogs create and select the new choice
without submitting the event or clearing its text and artwork upload. New cities
start hidden. Venues belong to the selected city; changing city filters its venues.
Each action requires staff access plus the corresponding Django add permission.
Existing Cities-page permissions are unchanged.

Music styles are a shared catalogue, suggested on talent genre fields as well as
selected on events. Existing free-text talent genres and event keys are preserved.
The public event API keeps `music_style` and adds `music_style_label` for display.
Case and whitespace variants of existing catalogue names return useful errors.
Apply the local schema updates with `./scripts/local.sh migrate`; this does not
configure Nocheva or enable ticketing commerce.
### Local Nocheva ticket simulation

The local launcher disables the loopback-only ticket adapter by default. Nocheva launch work is parked; retained simulation tests require an explicit `HOY_NOCHEVA_LOCAL=1` opt-in. It uses the existing
Nocheva integration credential at port 8769; ordinary event saves never provision inventory.
The adapter is disabled when `DEBUG` is false or `HOY_NOCHEVA_LOCAL` is not enabled.

```sh
./scripts/local.sh migrate --noinput
HOY_NOCHEVA_LOCAL=1 ./scripts/local.sh nocheva_local_login
HOY_NOCHEVA_LOCAL=1 ./scripts/local.sh provision_local_ticket_event EVENT_SLUG --config .local/FIXTURE.json
```

The fixture JSON contains `capacity`, `tiers` (name, positive `price_minor`, capacity) and
`terms` (version and approved synthetic allocation terms). Repeating the same provisioning
intent recovers its event; a changed intent is rejected. The existing-owner simulated login
renews `.local/nocheva-staff.json` with mode 0600, without granting roles or expanding API key
scopes. It uses Nocheva's simulated challenge inbox and sends no real email. Renew this session
if a restart or expiry prevents the explicit simulated-payment action.

The first-party `/tickets/<slug>/` page uses the `/api/v1/commerce/events/<slug>/` adapter.
Private recovery uses `X-Order-Token`, reservations use `Idempotency-Key`, and every browser
mutation requires CSRF. Tickets and QR come from confirmed Nocheva orders; local simulation
collects no money and produces no valid real-world admission. The current Nocheva contract
requires positive ticket prices; free events remain unavailable through this adapter.

Run the full Django suite with `./scripts/local.sh test --noinput`. Frontend builds can use a
separate `NEXT_DIST_DIR=.next-fourvenues-20261007` and
`NEXT_PUBLIC_API_URL=http://127.0.0.1:8017/api/v1` to preserve another preview's build cache.

Fourvenues is the selected external ticket provider for HOY. Configure each event through the existing Studio `ticket_url` and `ticket_provider` fields once its genuine HTTPS event page is supplied; use `Fourvenues` as that event's provider label. No real event URLs are configured by the default-mode change. Blank, placeholder, local, credential-bearing or non-HTTPS links produce no purchase button.

Studio's ticket checklist, overview warning and paid-event publish validation now
reject those unusable URLs too. A blank price is unannounced, not free; explicit
free entry and sold-out events retain their existing publish exceptions. URL
validation checks the destination's shape, not the provider account or event
identity. A draft can be prepared before its genuine ticket link is available.
