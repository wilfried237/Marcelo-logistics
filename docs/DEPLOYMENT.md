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
   - Authentication settings, matching `supabase/config.toml`: email provider on, minimum password length **12**, secure password change **on**; sign-ups and email confirmation per the [registration switch-on](#customer-registration-c-03-switch-on) (C-03: open registration).
   - URL configuration: Site URL = the site's URL; redirect allow-list `https://<host>/api/auth/callback**` only (the `**` allows the `?next=` query string; no other wildcards).
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
| `ENABLE_CUSTOMER_REGISTRATION` | C-03 answered (open). Switch-on checklist below completed (sign-ups + confirmation on, templates, custom SMTP) |
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
1. **Approve the migrations**, in this order: `20261104000000_backend_mvp`, then `20261104000100_outbox_legacy_rows`. Pushing to `master` applies both to the production database during the next production build (see the runbook below).
2. **Vercel environment (Production, and Preview if used):** `QUOTE_LINK_SECRET` (new, ≥ 32 random characters), `STAFF_NOTIFICATION_EMAIL` (your inbox, P-01), and when the Resend domain is verified (C-02): `ENABLE_TRANSACTIONAL_EMAIL=true`, `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`. Full list: [ENVIRONMENT.md](./ENVIRONMENT.md).
3. **Resend webhook:** endpoint `https://<site>/api/webhooks/resend`, events `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`; copy its signing secret into `RESEND_WEBHOOK_SECRET`.
4. **Supabase Auth email templates** (hosted): paste `supabase/templates/confirmation.html` (Confirm sign up), `invite.html` (Invite user) and `recovery.html` (Reset password) into Authentication → Email Templates, with the subjects from `supabase/config.toml`. Their links use `token_hash`, so the Site URL and redirect URLs must match `SITE_URL` (see the registration switch-on).
5. **Crons** (`vercel.json`): quote expiry 03:15 UTC and email processing 03:45 UTC, daily (Hobby limit). Emails are also delivered immediately after each action; the daily job retries failures. On a Pro plan, run `/api/cron/process-emails` every 5–15 minutes.
6. **Preview isolation (verified 2026-11-04):** Preview has no Supabase or database variables, no preview deployments exist, and the Ignored Build Step builds production only. Still: push only `master`, never this feature branch.
7. **`SITE_URL` (Production)** is `https://marcelo-logistics.vercel.app`, not the official domain. Before email or registration is switched on, the owner chooses the canonical host (`marchelo-logistics.com` or `www`), then `SITE_URL`, the Supabase Auth Site URL and redirect URLs are changed together (needs approval).
8. **First administrator:** production has no accounts yet (pre-check 2026-11-04). After the migration, bootstrap the first admin (DATABASE.md) before staff can use the admin area.

## Migration runbook: backend MVP (`20261104000000_backend_mvp` + `20261104000100_outbox_legacy_rows`)
Status: reviewed and rehearsed locally; **not applied to the hosted database**. It needs the owner's explicit approval.

### What it does to an existing production database (4 migrations applied)
| Area | Effect on existing data |
|---|---|
| Customers, staff, profiles, roles | None. No column, trigger or policy on `profiles`/`customers` changes, except a new trigger that queues a staff alert when a role changes |
| Quote requests | Two new nullable columns (`assigned_to` → profiles, `on delete set null`; `privacy_accepted_at`). Existing rows keep NULL (the request predates the acknowledgement); nothing is backfilled |
| Quotes | Existing quotes have no line items: allowed (the total check applies only when lines exist). The quote lifecycle gains QUOTED→UNDER_REVIEW and EXPIRED→UNDER_REVIEW |
| Shipments | New transition rule for **future** updates (delivered and cancelled are final; e.g. BOOKED→DELIVERED directly is refused). Existing statuses are not checked or changed |
| Tracking | `public_track_shipment` adds route countries and delivery time; it now joins quotes/requests, which always exist (`shipments.quote_id` is NOT NULL with a restricting FK) |
| Email log | New outbox columns (with defaults), `recipient` becomes nullable, new statuses. **Legacy rows** written by the previous version: unsent ones (PENDING/FAILED) are closed as SKIPPED so they are never sent late; legacy staff rows lose their stored inbox address. Sent history is kept |
| New tables | `quote_line_items`, `case_messages`, `contact_enquiries`, `job_runs`: RLS on, staff/owner policies, column grants (`case_messages.author_id` hidden from clients) |
| Audit | New tables are audited (personal fields redacted). Existing audit rows untouched |
| Locks | Short exclusive locks while altering `email_deliveries` and `quote_requests` and creating triggers on `quote_requests`, `shipments`, `shipment_events`, `profiles`. Tables are small: seconds. Run at a quiet time |

Evidence: `tests/db/upgrade-rehearsal.test.ts` builds the production state (first 4 migrations + data written by the previous version, including its email rows), applies the two migrations and checks that every existing row is unchanged, legacy emails are closed, in-flight quotes can still be accepted, tracking works, and a second run changes nothing. The **previous application version runs correctly on the new schema**: `master`'s own test suite passed against it (83 of 86; the 3 failures assert the old schema itself: table list, transition table, tracking field list).

### Preparation versus approval
| Step | Kind |
|---|---|
| Read-only pre-checks | Preparation (approved and run 2026-11-04, results below) |
| Backups | **Needs the owner**: dashboard backup is the owner's; a logical dump reads the database but writes files containing personal data |
| Applying the migrations (option A or B) | **Needs explicit approval** |
| Push to `master` | **Needs explicit approval**: deploys to production on the official domain |
| Post-checks | After the migration; read-only |
| Rollback (app or schema) | **Needs explicit approval** |

### Before (read-only checks)
Run in the Supabase SQL editor, or with a read-only session (`set session characteristics as transaction read only`):
```sql
select migration_name, checksum, finished_at, rolled_back_at, logs is not null as has_logs from _prisma_migrations order by started_at; -- exactly the 4, all finished, no logs
select status, split_part(idempotency_key, ':', 1) as kind, count(*) from public.email_deliveries group by 1, 2 order by 1, 2;
select count(*) from public.email_deliveries where recipient is null;                 -- must be 0
select status, count(*) from public.shipments group by 1;
select status, count(*) from public.quote_requests group by 1;
select count(*) from public.shipments s left join public.quotes q on q.id = s.quote_id
  left join public.quote_requests r on r.id = q.quote_request_id where r.id is null;   -- must be 0
select count(*) from pg_stat_activity where datname = current_database() and xact_start < now() - interval '1 minute'; -- 0 before applying
```

**Results on production (2026-11-04, read-only session, target confirmed identical to Vercel Production's `DIRECT_URL`):**
- PostgreSQL 17.6, database size 11 MB, no long-running transactions.
- `_prisma_migrations`: the 4 expected migrations, all finished, none rolled back, no error logs, **checksums identical to the repository**. Pending: `20261104000000_backend_mvp`, `20261104000100_outbox_legacy_rows`. None of their tables, columns or types exist yet (no partial application).
- **No data:** 0 Auth users, 0 profiles and customers, 0 quote requests, quotes, shipments, events, documents, audit rows and email rows; 1 rate-limit row.
- **No schema drift:** columns (95), indexes (30), triggers (20), functions (21, bodies identical), policies (19), RLS flags and enums match a database built from the 4 committed migrations.
- Consequence: the migrations touch no customer data; migration 2 has nothing to close.

**Backup** (still required, even with an empty database: it records the exact pre-upgrade state). Both, kept offline and encrypted:
1. Supabase → Database → Backups: confirm a recent backup exists (and note the PITR point if the plan has it).
2. Logical dump from a trusted machine with the session-pooler URL: `npx supabase db dump --db-url "$DIRECT_URL" -f schema.sql` and `npx supabase db dump --db-url "$DIRECT_URL" --data-only -f data.sql`. Check that both files are non-empty; never commit them.
3. Restoring: Supabase dashboard restore (whole project), or `psql "$DIRECT_URL" -f schema.sql` then `-f data.sql` into an **empty** database. A restore replaces everything written after the backup.

### Apply (choose one; both need approval)
- **A. With the deployment** (current design): merge to `master` → the Vercel production build runs `next build`, then `prisma migrate deploy`, then the deployment is promoted. If the migration fails, the build fails and the previous deployment stays live.
- **B. Ahead of the deployment** (recommended for this first large change, so it can be watched): from a trusted machine, `DIRECT_URL=<session pooler> ALLOW_MIGRATE_HOST=<pooler host> npm run db:migrate`, check, then merge (the deploy step then has nothing to apply). Safe because the previous version runs on the new schema.

### After
```sql
select migration_name, finished_at from _prisma_migrations order by started_at; -- 6 rows, all finished
select count(*) from public.email_deliveries where status in ('PENDING', 'FAILED') and idempotency_key ~ '^(ack|staff-new|quote-issued|shipment-update):'; -- 0
select public.public_track_shipment('<an existing reference>'); -- includes origin/destination
```
Then: bootstrap the first administrator (production has no accounts), the smoke tests on the official domain (public pages EN/FR, `/en/track`, sign-in), and `/api/cron/process-emails` with the bearer secret (expect `claimed` ≥ 0, no errors). Email stays off, so queued emails are recorded as skipped.

### Recovery
1. **Migration failed part-way:** the SQL is idempotent. Fix the cause, `npx prisma migrate resolve --rolled-back 20261104000000_backend_mvp` (or the failed one), and deploy again; it completes the remaining statements.
2. **Migration fine, new application faulty:** Vercel → Deployments → previous production deployment → **Instant Rollback**. Keep the schema (the previous version runs on it). While the old version runs, the database still queues emails that nobody sends; before re-deploying the new version, decide whether they should still go out, otherwise close them: `update public.email_deliveries set status = 'SKIPPED', error = 'held during rollback' where status = 'PENDING' and created_at < now() - interval '1 hour';`
3. **Schema must be removed** (last resort): export the new tables first (`npx supabase db dump --db-url "$DIRECT_URL" --data-only -f mvp-data.sql`), roll the application back (step 2), then run `docs/runbooks/backend-mvp-rollback.sql`. Tested: it restores the exact pre-upgrade schema (columns, constraints, indexes, triggers, functions, policies, grants, RLS).
4. **Data damaged:** restore the backup (Supabase restore or the dumps). Everything written after the backup is lost.

**Limitations:** PostgreSQL cannot remove enum values, so the 5 new email statuses remain after a rollback (unused, harmless). The rollback deletes the new tables' data (line items, notes, replies, contact enquiries, job runs) and assignments. Supabase Auth settings and email templates are dashboard settings, not covered by SQL; change them back by hand.

## Customer registration (C-03) switch-on
Open registration is implemented and tested (local Supabase + journey G). In production, in this order:
1. Custom SMTP in Supabase (Authentication → SMTP), using the verified sender domain (C-02). Supabase's built-in mailer is heavily rate-limited and not meant for production; check its current terms in the dashboard.
2. Authentication → Sign In / Providers: **Allow new users to sign up: on**; Email provider **Confirm email: on**; minimum password length 12; secure password change on.
3. Authentication → Email Templates: paste `supabase/templates/confirmation.html` (Confirm sign up), `invite.html`, `recovery.html`, with the subjects in `supabase/config.toml`. The links use `token_hash`, so they work in any browser or device.
4. Authentication → URL configuration: Site URL = production URL; redirect URL `https://<production-host>/api/auth/callback**`.
5. Authentication → Rate limits: review "emails sent per hour" for the SMTP provider.
6. Vercel Production: `ENABLE_CUSTOMER_REGISTRATION=true`, redeploy, then register with an inbox the owner controls and confirm.
To close registration again, set the flag to `false` (the form disappears) and turn sign-ups off in Supabase (the Auth API then refuses too).
