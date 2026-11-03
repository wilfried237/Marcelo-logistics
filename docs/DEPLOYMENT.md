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

## Database migrations on every production deployment
Vercel runs `npm run build`; after `next build` succeeds, `postbuild` runs `scripts/deploy-migrate.mjs`:

| Build | What happens |
|---|---|
| Vercel **production** with `DIRECT_URL` set | `prisma migrate deploy` applies any pending migration (none if already up to date). A failure stops the deployment, so new code never goes live on an outdated schema |
| Vercel production with no database variables | Skipped with a log line (the site runs with honest "not available" states) |
| Vercel production with `DATABASE_URL` but no `DIRECT_URL`, or `DIRECT_URL` on port 6543 | **Fails** with an explanation |
| Vercel **preview**, local, CI | Never migrates (previews must not touch production, even if they share variables) |

**Connecting Vercel to Supabase (recommended: the Vercel Supabase integration).**
Vercel → Storage → Supabase (or Integrations → Supabase), connected to the project's **Production** environment. The integration manages these variables, which the app reads directly; nothing needs to be copied by hand:

| Variable (set by the integration) | Used for |
|---|---|
| `POSTGRES_URL` | The running app (pooled connection) |
| `POSTGRES_URL_NON_POOLING` | Migrations (Supavisor **session** mode, IPv4) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auth, Storage, invitations |

When these are present they take precedence over `DATABASE_URL` / `DIRECT_URL`, so stale hand-copied values cannot break a deployment.

**Manual alternative** (no integration): `DIRECT_URL` = the Supabase **Session pooler** string (host `aws-…pooler.supabase.com`, port 5432, user `postgres.<project-ref>`, the real password, not `[YOUR-PASSWORD]`), and `DATABASE_URL` = the **Transaction pooler** string (port 6543). Do **not** use `db.<project-ref>.supabase.co`: it is IPv6-only (checked 2026-11-03) and Vercel builds cannot reach it.

**TLS:** Supabase signs its certificates with its own "Supabase Root 2021 CA", which Node does not trust by default (verified 2026-11-03: `SELF_SIGNED_CERT_IN_CHAIN`). The app and the migration tool therefore verify Supabase connections against that pinned root (`lib/db/connection.mjs`, `prisma/supabase-root-2021.crt`; SHA-256 `80:70:25:AD…E6:CA:FA`, identical in the certificate chain served by Supabase and in Supabase's published download). Verification is never switched off. Replace the file before it expires on 2031-04-26, or sooner if Supabase rotates its CA.

- Migrations are additive (a test forbids destructive SQL), so the previous deployment keeps working while they run. Concurrent deployments are safe: Prisma takes an advisory lock.
- After the first successful production deployment, bootstrap the first administrator (DATABASE.md) and check the Auth settings below.

Verified locally on 2026-11-03: on an empty Supabase database the step applied all 4 migrations (10 tables, all with RLS) and the 14 real-stack security tests passed; a second run applied nothing; a preview build skipped it.

## Production (requires explicit approval: R-03)
- Since 2026-11-03 a Vercel **production** build (on its `vercel.app` URL) succeeds while owner decisions are pending: the build log lists every unresolved `{{NEEDS_OWNER}}` marker, visitors see the neutral fallbacks, and `robots.txt` blocks indexing.
- The **launch** build for the business domain must set `RELEASE_BUILD=true` in Vercel's Production environment. That build **fails** while any marker remains, and it is the only build that allows search indexing. Set it only with launch approval (R-03).
- The domain cut-over from WordPress needs a migration plan: URLs and redirects, email records on the domain, and DNS ownership. Out of scope until approved.

## Backend MVP: what to configure before merging (2026-11-04)
1. **Approve the migration** `20261104000000_backend_mvp`: merging to `master` applies it to the production database on the next deployment.
2. **Vercel environment (Production, and Preview if used):** `QUOTE_LINK_SECRET` (new, ≥ 32 random characters), `STAFF_NOTIFICATION_EMAIL` (your inbox, P-01), and when the Resend domain is verified (C-02): `ENABLE_TRANSACTIONAL_EMAIL=true`, `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`. Full list: [ENVIRONMENT.md](./ENVIRONMENT.md).
3. **Resend webhook:** endpoint `https://<site>/api/webhooks/resend`, events `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`; copy its signing secret into `RESEND_WEBHOOK_SECRET`.
4. **Supabase Auth email templates** (hosted): paste `supabase/templates/recovery.html` and `invite.html` into Authentication → Email Templates with the subjects from `supabase/config.toml`.
5. **Crons** (`vercel.json`): quote expiry 03:15 UTC and email processing 03:45 UTC, daily (Hobby limit). Emails are also delivered immediately after each action; the daily job retries failures. On a Pro plan, run `/api/cron/process-emails` every 5–15 minutes.
6. **Previews share production variables today:** a preview of this branch would run new code against the production database **before** its migration. Use a separate preview database or keep preview variables empty until the migration is applied.
