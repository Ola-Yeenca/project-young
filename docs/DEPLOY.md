# Deploying House of Young

Everything runs in the Railway project **House of Young** (environment
`production`, region EU West, Amsterdam), next to the database in Paris:

- the `api` service runs the backend: the API, HOY Studio and Django admin;
- the `web` service runs the public website (Next.js).

The database and uploaded media are in SME Analytica's Supabase project "House
of Young" (`voctydqabimqsliyqhyk`, Paris eu-west-3), which is separate from
Analytica DB. The domain `fromthehouseofyoung.com` is registered and its DNS
hosted at Porkbun. Resend will send the email.

| Piece | Service | Address |
|---|---|---|
| Public website | Railway `web` (Railpack, Next.js) | `fromthehouseofyoung.com`, `www.fromthehouseofyoung.com` |
| API | Railway `api` (Docker) | `api.fromthehouseofyoung.com` |
| Studio and Django admin | Railway `api` (the same service) | `studio.fromthehouseofyoung.com` (admin under `/admin/`) |
| Database | Supabase Postgres 17, schema `hoy` | session pooler, Paris (eu-west-3) |
| Uploaded photos, posters and audio | Supabase Storage, public bucket `hoy-media` | `voctydqabimqsliyqhyk.supabase.co/storage/v1/object/public/hoy-media/...` |
| DNS | Porkbun | — |
| Booking and contact emails | Resend (not set up yet) | — |

Until Resend is set up, enquiries are still saved and show in Studio; the
notification emails fail quietly into the logs and visitors never see an error.

## 1. Supabase: database

The project is already set up. Django's tables live in a private `hoy` schema
owned by the `hoy_app` login. The schema is not exposed through Supabase's Data
API, so the public `anon` and `authenticated` keys can't read it, and nothing
should be added to `public`.

- Connect through the **session pooler** (port 5432, IPv4). The direct host is
  IPv6 only, and the transaction pooler (6543) breaks Django's server-side
  cursors and `conn_max_age`.
- `hoy_app` has `search_path = hoy`, so the connection string needs no schema
  option.
- The password lives only with whoever set the database up. If it's lost, reset
  it in Supabase → **SQL Editor** with
  `alter role hoy_app with password '...'` and update `DATABASE_URL` in Railway.
- Turn on **Settings → Infrastructure → Network restrictions** once Railway's
  outbound IPs are known.

## 2. Supabase Storage: media bucket

Uploads go to the public bucket `hoy-media` through Supabase's S3-compatible
endpoint. Public objects are served straight from Supabase with
`Access-Control-Allow-Origin: *`, which the vinyl wallpaper and HOY Radio need
because they read posters and audio from another origin.

1. The bucket exists already. To recreate it, run in the **SQL Editor**:
   `insert into storage.buckets (id, name, public) values ('hoy-media', 'hoy-media', true);`
2. Supabase dashboard → **Storage → Settings**, under S3 access keys → **New
   access key**. Copy the access key ID and the secret access key into the `api`
   variables in step 4.
   The secret is shown only once. The key can write to every bucket in the
   project, so keep it in Railway only.

## 3. Railway: services

Both services deploy from the `main` branch of `Ola-Yeenca/project-young`. If
Railway can't see the repository, grant it in GitHub → **Settings →
Applications → Railway → Configure**.

`api`:

- Root directory `backend`. Railway picks up `backend/railway.json`, which
  builds the Dockerfile and checks `/api/v1/health/`.
- Each deploy runs the migrations and `ensure_admin`, then starts Gunicorn on
  `[::]`, so it also answers on the private network (IPv6) as
  `api.railway.internal:8000`. Django allows that host by itself, from
  `RAILWAY_PRIVATE_DOMAIN`.
- Custom domains `api.fromthehouseofyoung.com` and
  `studio.fromthehouseofyoung.com`, both port 8000. Which one a request came
  in on decides what answers (see `HOY_STUDIO_HOST` below).

`web`:

- Root directory `frontend`. Railway picks up `frontend/railway.json`, which
  builds with Railpack (`npm run build`), starts with `npm run start` and checks
  `/`.
- `NEXT_PUBLIC_API_URL` = `https://api.fromthehouseofyoung.com/api/v1`, used
  by the server to render pages.
- `API_PROXY_URL` = `http://api.railway.internal:8000/api/v1`. The browser's
  `/api/v1/*`, `/media/*` and `/tickets/*` requests are forwarded there, over
  Railway's private network. Sent to the api's public domain instead, Railway's
  edge would replace the visitor's address with the web service's, and every
  visitor would share one rate limit.
- Both are read at build time (the rewrites are fixed during `next build`), so
  changing either needs a redeploy, not just a restart.
- Custom domains `fromthehouseofyoung.com` and `www.fromthehouseofyoung.com`.

Keep both services in EU West. Every page runs several queries, so a service
far from the database pays a round trip on each one.

## 4. Railway variables (`api`)

| Variable | Value |
|---|---|
| `DJANGO_SECRET_KEY` | Long random string: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_ALLOWED_HOSTS` | `api.fromthehouseofyoung.com` (the Railway domain and `HOY_STUDIO_HOST` are added automatically) |
| `HOY_STUDIO_HOST` | `studio.fromthehouseofyoung.com` (see below) |
| `DATABASE_URL` | `postgres://hoy_app.voctydqabimqsliyqhyk:<password>@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=require` |
| `AWS_STORAGE_BUCKET_NAME` | `hoy-media` |
| `AWS_ACCESS_KEY_ID` | Supabase S3 access key ID |
| `AWS_SECRET_ACCESS_KEY` | Supabase S3 secret access key |
| `AWS_S3_ENDPOINT_URL` | `https://voctydqabimqsliyqhyk.storage.supabase.co/storage/v1/s3` |
| `AWS_S3_REGION_NAME` | `eu-west-3` |
| `AWS_S3_CUSTOM_DOMAIN` | `voctydqabimqsliyqhyk.supabase.co/storage/v1/object/public/hoy-media` |
| `HOY_TRUSTED_PROXIES` | `2` (the default): Railway's edge writes two entries (see below) |
| `HOY_TEAM_EMAIL` | Inbox that receives booking and contact enquiries |
| `DJANGO_SUPERUSER_USERNAME` | First admin's username |
| `DJANGO_SUPERUSER_EMAIL` | First admin's email |
| `DJANGO_SUPERUSER_PASSWORD` | Strong password. Remove this variable once the first admin has signed in and changed it |

When Resend is set up, add:

| Variable | Value |
|---|---|
| `EMAIL_HOST` | `smtp.resend.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | `resend` |
| `EMAIL_HOST_PASSWORD` | Resend API key (`re_...`) |
| `DEFAULT_FROM_EMAIL` | `House of Young <hello@fromthehouseofyoung.com>` |

Optional:

- `SENTRY_DSN`: turns on error reports (no IP addresses or cookies are sent).
  `SENTRY_ENVIRONMENT` and `SENTRY_TRACES_SAMPLE_RATE` default to `production`
  and `0`.
- `DJANGO_TIME_ZONE`: default `Europe/Madrid`.
- `HOY_ENQUIRY_RATE` and `HOY_PHOTO_RATE`: defaults `10/hour` and `240/hour`.
- `DJANGO_LOG_LEVEL`: default `INFO`.
- `WEB_CONCURRENCY`: Gunicorn workers, default 3.
- `DJANGO_CSRF_TRUSTED_ORIGINS`: only needed for extra origins. Every allowed
  host is already trusted over https.

`DJANGO_DEBUG` must stay unset in production.

**Studio's host.** With `HOY_STUDIO_HOST` set, that host serves Studio at its
root (`/content/`, `/events/`, `/crowd/`, ...) and the Django admin at
`/admin/`, and nothing else: the API and the ticket pages answer 404 there.
Every page on it carries `X-Robots-Tag: noindex, nofollow` and
`Referrer-Policy: same-origin`, and `/robots.txt` disallows everything. On
`api.fromthehouseofyoung.com` (and any other host), `/studio/...` and
`/admin/...` redirect permanently to the same page on the studio host (301, or
308 for a form post). The host is added to the allowed hosts and trusted
origins by itself. Sign-in cookies stay on the host that set them, so the team
signs in again once after the move. Set the variable only once the studio
domain's DNS resolves and Railway shows its certificate, or the redirect sends
the team to a host that doesn't answer yet. Unset (local work, tests), Studio
stays at `/studio/` and the admin at `/admin/`.

**Visitor addresses.** Sign-in lockouts, rate limits and gallery stats need the
visitor's real address. Railway's edge throws away any `X-Forwarded-For` and
`X-Real-IP` a visitor sends, and writes `X-Forwarded-For: <visitor>, <edge
node>` (checked on the live api on 29 October 2026). `HOY_TRUSTED_PROXIES` is
how many entries from the right were written by our own proxies, so `2` reads
the visitor. The website's calls keep these headers because they reach the api
over the private network (`API_PROXY_URL` above). If another proxy is ever put
in front (a CDN, say), check what it writes. Then send a request with a made-up
`X-Forwarded-For` and confirm in the api's access log that the visitor's real
address is what gets counted.

## 5. Porkbun: DNS

In Porkbun → **Domain Management → `fromthehouseofyoung.com` → DNS**:

1. Delete Porkbun's parking records (the `ALIAS` on the bare domain and the
   wildcard `CNAME`, both pointing at `uixie.porkbun.com`). Keep any `MX` or
   `TXT` records for email.
2. Add the records Railway shows under each service's **Settings → Networking**:

   | Type | Host | Answer |
   |---|---|---|
   | `CNAME` | `api` | the `api` service's `*.up.railway.app` target for `api` |
   | `CNAME` | `studio` | the `api` service's `*.up.railway.app` target for `studio` |
   | `ALIAS` | (blank, the bare domain) | the `web` service's target for `fromthehouseofyoung.com` |
   | `CNAME` | `www` | the `web` service's target for `www` |
   | `TXT` | `_railway-verify`, `_railway-verify.api`, `_railway-verify.studio`, `_railway-verify.www` | the `railway-verify=...` value Railway shows for each domain |

3. Railway issues the certificates once the records resolve, usually within
   minutes. Check with `dig +short api.fromthehouseofyoung.com @curitiba.ns.porkbun.com`
   and in Railway's networking panel.

## 6. Resend: sending domain (when set up)

1. Sign up at <https://resend.com/signup> with a House of Young mailbox, turn on
   2FA and invite SME Analytica. The free plan covers 3,000 emails a month.
2. Resend → **Domains → Add domain** → `fromthehouseofyoung.com`, region EU
   (Ireland).
3. Add the records Resend shows at Porkbun: an `MX` and a `TXT` (SPF) on
   `send`, and a `TXT` (DKIM) on `resend._domainkey`. Then press **Verify**.
4. Add DMARC at Porkbun: `TXT` `_dmarc` →
   `v=DMARC1; p=none; rua=mailto:<team inbox>`.
5. Resend → **API Keys → Create** → **Sending access** for the domain. This key
   is the SMTP password in step 4.

## 7. Smoke test after a first deploy

1. `https://api.fromthehouseofyoung.com/api/v1/health/` returns `{"status": "ok"}`.
2. `https://fromthehouseofyoung.com` and `https://www.fromthehouseofyoung.com`
   load, and `https://fromthehouseofyoung.com/api/v1/cities/` returns the
   cities through the website's rewrite.
3. Log in at `https://studio.fromthehouseofyoung.com/` with the first
   admin. Change the password, then delete `DJANGO_SUPERUSER_PASSWORD` from
   Railway. `https://api.fromthehouseofyoung.com/studio/content/` should
   redirect to `https://studio.fromthehouseofyoung.com/content/`, and
   `https://studio.fromthehouseofyoung.com/api/v1/health/` should be a 404.
4. Studio → **Cities**: check that Lagos and Valencia exist, and add their
   venues.
5. Upload an event poster, then open the image URL. It should be served from
   `voctydqabimqsliyqhyk.supabase.co/storage/v1/object/public/hoy-media/`.
6. Submit the contact form. The enquiry should show in Studio. Once Resend is
   set up, `HOY_TEAM_EMAIL` should get the notification and Resend →
   **Emails** should read Delivered.
7. Add the team in Django admin → Users, in the **HOY team** group. Superuser
   status is only for SME Analytica.

To load demo content on a staging service only, run
`railway run python manage.py seed_demo`. Never run it on production.

## 8. Routine jobs

- **Backups:** Supabase keeps 7 days of daily backups on the Pro plan
  (**Database → Backups**). Do a test restore once, into a scratch project
  rather than over the live one.
- **Data retention (GDPR / NDPA):** Railway cron service, monthly
  (`0 3 1 * *`), using the same image with this start command:
  `python manage.py purge_old_enquiries --months 24`.
- **Staging:** a second Railway environment that deploys the
  `claude/magical-babbage-v09ceo` branch, with its own database and bucket
  (`hoy-media-staging`).
