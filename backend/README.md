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

Admin: http://localhost:8000/admin/ · API: http://localhost:8000/api/v1/

Emails print to the terminal in debug mode.

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
manage all content and enquiries but not user accounts. The group's permissions
are refreshed on every `migrate`.

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

The enquiry endpoints need `privacy_accepted: true` and an email or a phone
number. They are rate limited per IP (`HOY_ENQUIRY_RATE`, default 10 an hour)
and reject anything that fills the hidden `website` field. A successful post
returns only the reference, e.g. `HOY-BK-260001`. It then emails the team (Site
settings → booking or contact email) and sends the client a confirmation.

## Production

Set the variables in `.env.example`: a secret key, allowed hosts, `DATABASE_URL`
for Postgres, the S3/R2 bucket for uploads and SMTP details. The `Dockerfile`
runs migrations and starts Gunicorn on `$PORT`, so Railway, Render or Fly.io
can deploy it as is.

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
