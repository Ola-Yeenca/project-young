# House of Young — Go-Live Plan (Valencia + Lagos, built to expand)

_Status: proposal for discussion. Prepared 2026-10-05 from the current codebase and the "Website Structure & Development Brief" PDF._

---

## 1. Where we are today

### What the brief asks for
Six public sections and a self-service admin:

| Section | Brief requirement | In the repo today |
|---|---|---|
| Home | Featured events + featured talent, CTAs (Buy Tickets, Book Talent, Gallery, Contact), black-and-gold identity | Partial. Copy is "fostering entrepreneurs" positioning, not entertainment-company positioning. No talent block. |
| Events | Name, date, venue, poster, price, **Buy Tickets → Fourvenues link**, easy to add venues | Partial. `Event` model exists but has no venue (the `Venue` model was deleted in migration 0022), no ticket URL, no city. Event detail page requires login. |
| Talent | Profiles (photos, bio, location, genre, past work, links, media) + **booking enquiry form** | Missing entirely. |
| Gallery | Photos, video highlights, per-event albums | Missing. |
| Shop | Products, variants, cart, checkout, order confirmation | Missing. |
| Contact Us | About, FAQ, categorised contact form | Static template only. No form handling, no FAQ model, no enquiry inbox. |
| Admin | Team manages everything without a developer | Django admin + Jazzmin is wired up. Only Event and BlogPost are registered. |

### What the code is
Django 4.2 monolith (`House Of Young/`), three apps: `core` (events, blog), `custom_user` (email-login user + profile), `sessions` (signup, email activation, login, profile). It boots (`manage.py check` passes) but is a development scaffold, not a production system:

- **Not deployable as-is.** SQLite database, media stored on local disk, `DEBUG` defaults to on, `ALLOWED_HOSTS` is localhost only, secret key falls back to a hard-coded default, Gmail SMTP with a personal inbox, debug toolbar loaded unconditionally, `django-jazzmin` used but missing from `requirements.txt`.
- **Security gap.** The REST API (`/api/event/`) is a full read/write `ModelViewSet` with no authentication or permission classes. Anyone on the internet could create, edit or delete events.
- **Broken tests.** `core/tests.py` imports models that no longer exist (Attendee, Venue, Sponsor, Session…), so the suite errors before running a single test.
- **Repo hygiene.** 34 MB of media committed, including ~510 test QR-code PNGs; `db.sqlite3` is checked in; one migration is pending (`is_published` default changed); `DEFAULT_FROM_EMAIL` contains a newline, which produces an invalid header.
- **Django 4.2 LTS reached end of extended support in April 2026.** We should be on 5.2 LTS before launch.
- **User accounts add friction.** Signup/activation/login works, but nothing in the brief needs visitors to have accounts. The event detail page currently forces login, which would lose ticket buyers.

### Verdict
Keep Django and the repo. The admin-managed content site in the brief is exactly what Django does well, and the auth/user plumbing is reusable for the HOY team's admin logins. But treat `core` as a scaffold: rebuild the domain models around the brief rather than patching the current ones.

---

## 2. Product strategy

### Positioning
Entertainment-industry company operating in **two markets from day one**: Valencia (Spain) and Lagos (Nigeria). Events, talent management, media, merchandise, business enquiries. "Powered by SME Analytica" in the footer.

### What v1 is and is not
**v1 is a showcase-and-enquiry platform**: it sells tickets through a partner, generates talent-booking and business leads, and shows the brand's work. It is not a marketplace, not a ticketing engine, and not (yet) an e-commerce store.

Build vs. buy, deliberately:

| Capability | Decision | Why |
|---|---|---|
| Ticketing | **Buy.** Link out per event. Fourvenues for Valencia (per brief). A Nigerian provider for Lagos (Tix.africa, Paystack Storefront, or Flutterwave Events) because Fourvenues is Spain/EU-centric and does not settle in naira. | Ticketing carries payment, fraud, refund and door-scanning complexity. Not our edge. |
| Talent bookings | **Build.** Enquiry form → database + email notification → admin inbox with status. | This is the core business process and the data is ours. |
| Gallery | **Build** (images). **Embed** video (YouTube/Instagram/Vimeo URLs). | Hosting video is expensive and slow; embedding is free. |
| Shop | **Phase 3, not v1.** Start with Stripe Payment Links or a Shopify Buy Button embedded in a Django product page. Build a native cart only once merch has sold. | Checkout, tax (Spanish IVA vs Nigerian VAT), shipping and returns are a product on their own. Validate demand first. |
| Blog | **Drop from nav**, keep model for "News" later. | Not in the brief; it was a placeholder. |
| Public user accounts | **Remove from public site.** Keep for staff. | Nothing in the brief needs them; they add friction and support load. |

### Multi-city from the first commit
Every content object gets a `City` (Valencia, Lagos, later Accra/London/…). A city carries its own currency (EUR/NGN), timezone (Europe/Madrid, Africa/Lagos), ticket provider default, WhatsApp number and Instagram handle. The homepage shows both cities; a visitor can filter. This is a one-table decision now that avoids a rewrite when city three arrives.

---

## 3. Target architecture

- **Framework:** Django 5.2 LTS, Python 3.12.
- **Database:** PostgreSQL (managed, by the host).
- **Media:** S3-compatible object storage (Cloudflare R2 or AWS S3) via `django-storages`; thumbnails via `django-imagekit`. Nothing user-uploaded lives on the app server.
- **Static:** WhiteNoise (already in place).
- **App server:** Gunicorn behind the host's proxy; Docker image; `.env`-driven settings split into `base / dev / prod`.
- **Hosting:** Railway or Render (one-click Postgres, zero ops) for v1. Move to a VPS only if cost or latency to Lagos becomes a problem.
- **Email:** Resend or Postmark for enquiry notifications and auto-replies. Remove Gmail SMTP.
- **Observability:** Sentry (errors), host logs, UptimeRobot ping.
- **CI:** GitHub Actions on every PR: `ruff`, `manage.py check --deploy`, `makemigrations --check`, test suite.
- **Admin:** Django admin + Jazzmin, with the HOY black-and-gold theme and "featured" toggles on Event and Talent.
- **Analytics:** Plausible or GA4, plus UTM-tagged outbound ticket links so we can attribute Fourvenues sales to the site.

### Data model (v1)

```
City            name, slug, country, currency, timezone, whatsapp, instagram, default_ticket_provider
Venue           name, slug, city → City, address, map_url, capacity
Event           title, slug, city → City, venue → Venue, starts_at, ends_at, poster, description,
                ticket_url, ticket_provider, price_from, currency, status (draft/published/past/cancelled),
                is_featured, featured_order
Talent          name, slug, city → City, genre, bio, hero_photo, previous_work, booking_available,
                is_featured, featured_order, spotify/apple/youtube/instagram/tiktok/x URLs
TalentMedia     talent → Talent, image | video_url, caption, order
GalleryAlbum    title, slug, city → City, event → Event (optional), cover, published
GalleryItem     album → GalleryAlbum, image | video_url, caption, order
BookingEnquiry  talent → Talent (optional), client_name, company, email, phone, event_date,
                event_location, event_type, expected_audience, message, status, internal_notes, created_at
ContactEnquiry  category (general/talent/collab/business/press/other), name, email, phone, subject,
                message, status, created_at
FAQ             category, question, answer, order, published
SiteSettings    singleton: about text, footer, social links, "Powered by SME Analytica" toggle
Product / Variant / Order   Phase 3 only
```

Everything in `core` that is not in this list (`Index`, `Organizer`, the QR mixin, the open API) gets removed.

---

## 4. Phased plan

### Phase 0 — Foundations (Week 1)
Goal: a clean, deployable skeleton on a staging URL, before writing features.

- Repo cleanup: delete committed media, QR PNGs, `db.sqlite3`, `collected_static`; add them to `.gitignore`; move the project to the repo root (drop the `House Of Young/` directory with spaces in the name).
- Upgrade Django to 5.2 LTS, pin requirements, add `django-jazzmin` to requirements, fix `typing_extensions` pin conflict.
- Settings split + `.env.example`; `check --deploy` clean; `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, HTTPS settings, secure cookies.
- Delete the open REST API and the broken test file; add a smoke test that every public URL returns 200.
- Dockerfile, GitHub Actions CI, deploy to staging with Postgres and R2.
- Accounts to open: hosting, R2/S3, Resend/Postmark, Sentry, Fourvenues organiser account, Lagos ticket provider, domain + DNS (Cloudflare).

Exit criterion: staging URL serves the current homepage over HTTPS from Postgres with CI green.

### Phase 1 — Build v1 (Weeks 2–5)
Goal: every section of the brief except Shop, fully manageable from admin.

Week 2 — Models, admin, City/Venue/Event. Jazzmin theme in black and gold. Event list + detail pages (no login). "Buy Tickets" button with provider-specific label. Featured toggles.
Week 3 — Talent profiles + TalentMedia + Booking enquiry form (server-side validation, honeypot + rate limit, email notification to HOY, auto-reply to client). Admin inbox with status (new / contacted / confirmed / declined).
Week 4 — Gallery albums + items, lazy-loaded responsive images, video embeds. Contact form with categories, FAQ model and page, About content via SiteSettings.
Week 5 — Homepage assembly (featured events, featured talent, intro, four CTAs). SEO basics (titles, Open Graph for event and talent pages, sitemap, robots). Cookie consent + privacy policy + legal notice. Mobile QA. Lighthouse pass. Content loading begins.

Exit criterion: HOY team can add an event, a talent, an album and an FAQ in admin without touching code; enquiries arrive by email and in admin.

### Phase 2 — Launch and operate (Weeks 6–8)
Goal: live in both cities with real content and measurable traffic.

- Content load: all current talent (photos, bios, links), next 3+ events per city, at least two gallery albums per city, 10–15 FAQs.
- Soft launch to friends/partners; fix what breaks; then public launch tied to the next HOY event in each city.
- Instagram link-in-bio → site. WhatsApp CTA prominent on Lagos pages (WhatsApp is the default contact channel there). Email capture ("get event drops first") via a simple newsletter form into Mailchimp/Brevo/Resend Audiences.
- Weekly KPI review (see §6).
- Ops routine: one person owns the enquiry inbox with a 24-hour reply SLA; one person owns weekly event/gallery updates.

### Phase 3 — Shop (Weeks 9–14, only if Phase 2 KPIs justify it)
- Step 1 (1 week): Product/Variant models + product pages in Django, checkout via Stripe Payment Links (EUR) and Paystack payment pages (NGN). Orders arrive by email. Zero cart code.
- Step 2 (later): native cart + Stripe/Paystack Checkout sessions + order admin + shipping zones, only if merch sells consistently.

### Phase 4 — Expansion (quarter 2+)
- Add a city = one admin row. Optional city subpaths (`/valencia/`, `/lagos/`) and localised copy.
- Spanish translation for Valencia (`USE_I18N` is already on; add `django-modeltranslation` for content fields).
- Fourvenues API integration for ticket sales reporting in admin.
- Talent self-service: talent log in to update their own profile and see their enquiries.
- Sponsor/partner pages, press kit, event recap posts ("News").

---

## 5. Market-specific notes

### Valencia (EU)
- GDPR: cookie consent, privacy policy, data retention policy for enquiries (delete after 24 months), DPA with hosting/email providers. LSSI-CE legal notice (aviso legal) with the operating company's details.
- Ticketing: Fourvenues (brief). Confirm organiser account ownership and fee structure.
- Language: English first, Spanish in Phase 4. Many Valencia attendees are Spanish-speaking; do not leave this for too long.
- Payments (shop): Stripe, EUR, Spanish IVA.

### Lagos (NG)
- Nigeria Data Protection Act 2023 applies; the same privacy policy with a Nigeria section covers it.
- Ticketing: Fourvenues does not settle in NGN, so Lagos events need a local provider. Shortlist: Tix.africa (events-native, Paystack-backed), Paystack Storefront (simplest), Flutterwave Events. Decide in Phase 0.
- Contact: WhatsApp click-to-chat on every Lagos talent and event page. Phone number field on enquiry forms should accept +234 formats.
- Performance: Lagos mobile data is slower and pricier. Image optimisation (WebP, responsive sizes, lazy loading) and a CDN in front of R2 matter more here than in Valencia. Test on a throttled 3G profile.
- Payments (shop): Paystack or Flutterwave, NGN.

### Expansion rule
A new city launches when it has: a City row, a ticket provider, a WhatsApp/contact owner, 2+ events and 3+ talent ready. Nothing else should need to change.

---

## 6. Success metrics (reviewed weekly from launch)

| Metric | Target by end of Phase 2 |
|---|---|
| Unique visitors / week (per city) | 500 Valencia, 1,000 Lagos |
| Outbound "Buy Tickets" clicks per published event | 15% of event page views |
| Talent booking enquiries / month | 10 qualified |
| Contact enquiries answered within 24 h | 90% |
| Admin content updates made without a developer | 100% |
| Lighthouse mobile performance | ≥ 80 |

---

## 7. Team, effort and cost

**Effort (one developer, with Claude Code):** roughly 8 weeks to v1 public launch at ~3 focused days per week. Content production (photos, bios, FAQs) is the usual bottleneck, not code; assign an owner on the HOY side in Week 1.

**Roles:**
- Product owner (HOY): decisions, content, enquiry inbox.
- Developer (SME Analytica): build, deploy, maintain.
- Designer (part-time or contracted, Weeks 1–3): black-and-gold design system, event poster template, talent photo guidelines.

**Running costs (approximate, monthly):** hosting + Postgres $10–25, object storage $0–5, transactional email $0–20, domain ~$1, Sentry free tier. Under $50/month before ticketing and payment fees, which are per-transaction and borne by the ticket/shop provider.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Content never arrives; site launches empty | Content owner named in Week 1; launch gated on the §4 Phase 2 content list. |
| Lagos ticketing provider has poor payout or UX | Trial two providers with a small event before committing. `ticket_url` is provider-agnostic. |
| Scope creep toward a native shop or ticketing before there is demand | Phase 3 gated on Phase 2 KPIs. Build-vs-buy table in §2 is the reference. |
| Spam on enquiry forms | Honeypot + rate limiting + Cloudflare Turnstile. |
| Single developer availability | CI, Docker and documented deploy mean anyone can ship. |
| Brand inconsistency between cities | One design system, city-specific content only. |

---

## 9. Decisions needed from HOY / SME Analytica

1. **Lagos ticketing provider** (Tix.africa / Paystack / Flutterwave). Needed in Phase 0.
2. **Shop in v1 or Phase 3?** Recommendation: Phase 3, embedded payment links first.
3. **Hosting preference** (Railway / Render / existing SME Analytica infrastructure).
4. **Domain** and whether Lagos gets `/lagos/` or just a city filter at launch. Recommendation: filter only.
5. **Content owner** on the HOY side and a launch-event date per city to anchor the public launch.
6. **Public user accounts**: confirm removal from the public site (keep for staff).

---

## 10. Immediate next steps (can start today)

1. Phase 0 repo cleanup and settings hardening PR (removes the open API, committed media, hard-coded secrets; adds `.env.example`, CI, Dockerfile, Django 5.2).
2. Models + admin PR for City, Venue, Event, Talent, Gallery, Enquiries, FAQ, SiteSettings.
3. Staging deploy.
