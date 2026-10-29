# Deploying House of Young

The backend (API, HOY Studio and Django admin) runs on Railway next to our
existing services. Cloudflare handles DNS and media storage (R2), and Resend
sends the email.

Placeholder domain used below: `houseofyoung.com`. Swap in the real one.

| Piece | Service | Address |
|---|---|---|
| API, Studio, admin | Railway (Docker) | `api.houseofyoung.com` |
| Database | Railway Postgres | internal |
| Uploaded photos and videos | Cloudflare R2 | `media.houseofyoung.com` |
| DNS, SSL, CDN | Cloudflare | — |
| Booking and contact emails | Resend | `hello@houseofyoung.com` |
| Public website (next phase) | Cloudflare Pages or Railway | `houseofyoung.com` |

## 1. Accounts to create (owned by House of Young)

Register both accounts with a House of Young mailbox (for example
`tech@houseofyoung.com`) rather than a personal one, turn on 2FA, and invite
SME Analytica as a member. That way the client owns the accounts and access can
be handed over or removed cleanly.

- **Cloudflare**: <https://dash.cloudflare.com/sign-up>. The free plan covers
  DNS and SSL. R2 needs a payment card on file but includes 10 GB storage and
  free egress each month.
- **Resend**: <https://resend.com/signup>. The free plan covers 3,000 emails a
  month and 1 domain, which is plenty for enquiry notifications.

## 2. Cloudflare: domain and DNS

1. Cloudflare → **Add a domain** → `houseofyoung.com` → Free plan.
2. Cloudflare lists two nameservers. Set them at the registrar where the domain
   was bought. DNS can take up to 24 hours to switch over, but it usually takes
   minutes.
3. Before switching, check that Cloudflare imported the existing records
   (especially any MX records for current email) so that nothing breaks.

## 3. Cloudflare R2: media bucket

1. R2 → **Create bucket** → name `hoy-media`, location Automatic.
2. Bucket → **Settings → Custom Domains → Connect domain** →
   `media.houseofyoung.com`. Cloudflare adds the DNS record itself. Leave the
   bucket's r2.dev URL disabled.
3. R2 → **Manage API tokens → Create API token**:
   - Permission: **Object Read & Write**
   - Specify bucket: `hoy-media` only
   - Copy the **Access Key ID**, the **Secret Access Key** and the **S3
     endpoint** (`https://<account-id>.r2.cloudflarestorage.com`). The secret
     is shown only once.

## 4. Resend: sending domain

1. Resend → **Domains → Add domain** → `houseofyoung.com`, region EU (Ireland).
2. Resend shows the DNS records to add: an MX and a TXT (SPF) record on
   `send.houseofyoung.com`, and a TXT (DKIM) record on
   `resend._domainkey.houseofyoung.com`. Add each one in Cloudflare → DNS,
   with **DNS only** (grey cloud), then press **Verify** in Resend.
3. Add DMARC in Cloudflare: TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:tech@houseofyoung.com`.
4. Resend → **API Keys → Create** → permission **Sending access**, domain
   `houseofyoung.com`. This key is the SMTP password.

## 5. Railway: service and database

1. In our Railway project → **New → GitHub repo** → `project-young`.
2. Service **Settings**:
   - Root directory: `backend`. Railway picks up `backend/railway.json`, which
     builds the Dockerfile and checks `/api/v1/health/`.
   - Branch: `main`, once the work is merged.
3. **New → Database → PostgreSQL** in the same project.
4. Add the variables in step 6, then deploy.
5. Service **Settings → Networking → Custom domain** → `api.houseofyoung.com`.
   In Cloudflare, add the CNAME that Railway shows, with **DNS only** (grey
   cloud) until Railway has issued the certificate. After that it can be
   proxied, with SSL mode **Full (strict)**.

Each deploy runs the migrations and `ensure_admin`, then starts Gunicorn.

## 6. Railway variables

| Variable | Value |
|---|---|
| `DJANGO_SECRET_KEY` | Long random string: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_ALLOWED_HOSTS` | `api.houseofyoung.com` (the Railway domain is added automatically) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `AWS_STORAGE_BUCKET_NAME` | `hoy-media` |
| `AWS_ACCESS_KEY_ID` | R2 access key ID |
| `AWS_SECRET_ACCESS_KEY` | R2 secret access key |
| `AWS_S3_ENDPOINT_URL` | `https://<account-id>.r2.cloudflarestorage.com` |
| `AWS_S3_REGION_NAME` | `auto` |
| `AWS_S3_CUSTOM_DOMAIN` | `media.houseofyoung.com` |
| `EMAIL_HOST` | `smtp.resend.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | `resend` |
| `EMAIL_HOST_PASSWORD` | Resend API key (`re_...`) |
| `DEFAULT_FROM_EMAIL` | `House of Young <hello@houseofyoung.com>` |
| `HOY_TEAM_EMAIL` | Inbox that receives booking and contact enquiries |
| `DJANGO_SUPERUSER_USERNAME` | First admin's username |
| `DJANGO_SUPERUSER_EMAIL` | First admin's email |
| `DJANGO_SUPERUSER_PASSWORD` | Strong password. Remove this variable after the first deploy |

Optional:

- `DJANGO_TIME_ZONE`: default `Europe/Madrid`.
- `HOY_ENQUIRY_RATE`: default `10/hour`.
- `DJANGO_LOG_LEVEL`: default `INFO`.
- `WEB_CONCURRENCY`: Gunicorn workers, default 3.
- `DJANGO_CSRF_TRUSTED_ORIGINS`: only needed for extra origins. Every allowed
  host is already trusted over https.

`DJANGO_DEBUG` must stay unset in production.

## 7. Smoke test after the first deploy

1. `https://api.houseofyoung.com/api/v1/health/` returns `{"status": "ok"}`.
2. Log in at `/studio/` with the first admin. Change the password, then delete
   `DJANGO_SUPERUSER_PASSWORD` from Railway.
3. Studio → **Cities**: check that Lagos and Valencia exist, and add their
   venues.
4. Upload a talent photo, then open the image URL. It should be served from
   `media.houseofyoung.com`.
5. Submit the contact form (`POST /api/v1/enquiries/contact/`). The enquiry
   should show in Studio, and `HOY_TEAM_EMAIL` should get the notification. In
   Resend → **Emails**, the status should read Delivered.
6. Add the team in Django admin → Users, in the **HOY team** group. Superuser
   status is only for SME Analytica.

To load demo content on a staging service only, run
`railway run python manage.py seed_demo`. Never run it on production.

## 8. Routine jobs

- **Backups:** Railway Postgres has daily backups on paid plans. Turn them on,
  and do a test restore once before launch.
- **Data retention (GDPR / NDPA):** Railway cron service, monthly
  (`0 3 1 * *`), using the same image with this start command:
  `python manage.py purge_old_enquiries --months 24`.
- **Staging:** a second Railway environment that deploys the
  `claude/magical-babbage-v09ceo` branch, with its own database and bucket
  (`hoy-media-staging`).
