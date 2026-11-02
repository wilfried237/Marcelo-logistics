# Deployment

> **Nothing has been deployed.** No DNS, domain or production change has been made, no hosted Supabase project has been migrated, and the WordPress site on `marchelo-logistics.com` remains untouched.

## Target
- **Vercel**: protected preview deployments only during implementation. `vercel.json` pins functions to `dub1` (Dublin); change it to `fra1` if the Supabase project is in Frankfurt (R-01).
- **Supabase** project in an approved EU region (owner decision R-01).
- **Resend** with a verified sending domain (owner decision C-02).

## Protected preview checklist
Every step below needs the owner's accounts and approval; none has been done.

1. Owner creates or approves the Vercel and Supabase accounts and the region (R-01).
2. **Supabase**
   - Apply the migrations **only after approval** (R-02): backup, review, `npm run db:migrate` with `ALLOW_MIGRATE_HOST`; procedure in [DATABASE.md](./DATABASE.md#applying-to-supabase-after-approval-r-02).
   - Authentication settings, matching `supabase/config.toml`: public sign-ups **off** (invitation-only until C-03), email provider on, minimum password length **12**, secure password change **on**. If registration is opened later (C-03), turn email confirmations on at the same time.
   - URL configuration: Site URL = the preview URL; redirect allow-list `https://<preview-host>/api/auth/callback` only (no wildcards beyond the project's own preview domain).
   - Custom SMTP stays unset until the Resend domain is verified (C-02); Supabase's built-in mailer is rate-limited and for testing only.
   - Bootstrap the first administrator (DATABASE.md).
3. **Vercel → Project → Settings**
   - **Deployment Protection: on** (Vercel Authentication or password) for every preview, so unfinished pages are never public.
   - Environment variables for **Preview** only (names in `.env.example`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooler, port 6543), `SITE_URL`, `RATE_LIMIT_SALT`, `CRON_SECRET`. `DIRECT_URL` is only for migrations and is not needed by the running app. Never give a secret a `NEXT_PUBLIC_` prefix (`npm run check:security` enforces this).
   - Keep `RETENTION_EXECUTION_ENABLED` unset.
4. **Scheduled jobs**: `vercel.json` schedules `/api/cron/expire-quotes` once a day (03:15 UTC), because Vercel Hobby plans reject deployments whose crons run more than daily. On a Pro plan the schedule can be tightened (for example hourly). Vercel runs crons **only on production deployments**, so on a preview call it manually with the bearer secret if needed. Without `CRON_SECRET` the endpoint answers `503 CRON_DISABLED`. Expired quotes are already refused at acceptance, so a missed run is not a correctness problem.
5. Keep the `ENABLE_*` flags off on the preview until each prerequisite is met:

| Flag | Enable only when |
|---|---|
| `ENABLE_QUOTE_SUBMISSION` | Database migrated, staff reviewer assigned (P-01), email working (C-02) |
| `ENABLE_TRANSACTIONAL_EMAIL` | Resend domain verified, `EMAIL_FROM` and `STAFF_NOTIFICATION_EMAIL` set |
| `ENABLE_CUSTOMER_REGISTRATION` | Owner chooses open registration (C-03) **and** Supabase sign-ups are enabled |
| `ENABLE_DOCUMENT_UPLOADS` | Retention policy approved (L-03) |
| `ENABLE_DEMO_DATA`, `ENABLE_PREVIEW_AREAS` | Never on production (forced off by code) |

6. Smoke test on the preview: public pages in EN/FR, response headers (nonce CSP, HSTS), sign-in as the bootstrapped admin, invite a staff member to a test address the owner controls, and `node scripts/verify-local-journeys.mjs`-style checks by hand. Do not send messages to real customers.

## Production (requires explicit approval: R-03)
- A Vercel production build sets `VERCEL_ENV=production`, which makes the build **fail** while any `{{NEEDS_OWNER}}` marker remains. This is intentional.
- The domain cut-over from WordPress needs a migration plan: URLs and redirects, email records on the domain, and DNS ownership. Out of scope until approved.
