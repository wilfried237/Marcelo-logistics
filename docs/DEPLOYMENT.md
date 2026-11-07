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
   - Apply the migrations **only after approval** (R-02): backup (deferred for the first release, see the migration runbook), review, `npm run db:migrate` with `ALLOW_MIGRATE_HOST`; procedure in [DATABASE.md](./DATABASE.md#applying-to-supabase-after-approval-r-02).
   - Authentication settings, matching `supabase/config.toml`: email provider on, minimum password length **12**, secure password change **on**; sign-ups and email confirmation per the [registration switch-on](#customer-registration-c-03-switch-on) (C-03: open registration).
   - URL configuration: exact values in [Supabase Auth URLs: local versus production](#supabase-auth-urls-local-versus-production).
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
| Backups | **Deferred by the owner (2026-11-05)** for the first release; see "Backup status" below. When resumed: dashboard backup is the owner's; a logical dump reads the database but writes files containing personal data |
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

### Backup status for the first release (owner decision, 2026-11-05)
- **No manual production backup has been created.** No `supabase db dump` was run and no restore rehearsal was done.
- **Why:** the project is brand new. The production database holds no customer or operational data (pre-check above: 0 users, 0 requests, quotes, shipments and emails; 1 rate-limit row), so a dump would record only the empty schema that the 4 committed migrations already describe.
- **Accepted release risk:** the owner explicitly accepts proceeding with the first production deployment without a manual backup.
- **Not verified:** whether the Supabase dashboard holds an automatic backup, and its time, depends on the plan; it was not checked.
- **Revisit** before the site handles real customer information, and before any later significant database change: from then on, take the backup below before every production migration.

### Backup procedure (for future use)
Supabase's documented three-file backup, from a trusted machine, with the **session pooler** connection (port 5432). The connection string is a secret: do not paste it into shared shells or logs.
```
npx supabase db dump --db-url "$DIRECT_URL" -f roles.sql --role-only
npx supabase db dump --db-url "$DIRECT_URL" -f schema.sql
npx supabase db dump --db-url "$DIRECT_URL" -f data.sql --data-only --use-copy
```
- `roles.sql`: custom roles only (no passwords; Supabase's built-in roles are excluded).
- `schema.sql`: the project's schemas (`public`: tables, functions, triggers, policies, grants); Supabase-managed schemas (`auth`, `storage`, …) are excluded because the platform recreates them.
- `data.sql`: the data of all schemas, including `public` (with `_prisma_migrations`), `auth` (users) and `storage` (metadata only), as `COPY` statements.
- **Not included:** files in Storage, Auth/SMTP/template settings, Vault secrets, Edge Functions.
- Before the dump: Supabase → Database → Backups, note the newest scheduled backup (time, status) and the PITR window if the plan has one.
- After the dump: check the three files are non-empty, record their SHA-256 sums, keep them offline, encrypted and access-restricted; never commit them.
- **Restore** only into a new or empty project, never over production:
  `psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command 'SET session_replication_role = replica' --file data.sql --dbname "<target connection>"`. A restore replaces everything written after the backup.

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

### How a failed migration behaves (verified 2026-11-05 on local PostgreSQL 17 with the real Prisma CLI)
- Prisma applies **each migration file in one transaction**. A failure part-way leaves **no partial change**: no new tables, columns, functions or enum values, data untouched; `_prisma_migrations` records the migration as failed.
- `prisma migrate deploy` then exits non-zero, `scripts/deploy-migrate.mjs` exits non-zero, `npm run build` fails, and Vercel does **not** promote the deployment: the previous version stays live on the unchanged schema.
- Migration 1 can succeed and migration 2 fail: migration 1 stays applied, the deployment is not promoted, and the previous version keeps running on migration 1's schema (compatible, see below).
- A failed migration blocks further deployments until it is resolved (step 1 below).

### Recovery
1. **Migration failed:** nothing was applied by the failed file. Fix the cause, run `npx prisma migrate resolve --rolled-back 20261104000000_backend_mvp` (or the failed one) against production (needs approval), then deploy again. Tested: the redeploy completes and the schema equals a clean upgrade.
2. **Migration fine, new application faulty:** Vercel → Deployments → previous production deployment → **Instant Rollback**. Keep the schema (the previous version runs on it). While the old version runs, the database still queues emails that nobody sends; before re-deploying the new version, decide whether they should still go out, otherwise close them: `update public.email_deliveries set status = 'SKIPPED', error = 'held during rollback' where status = 'PENDING' and created_at < now() - interval '1 hour';`
3. **Schema must be removed** (last resort): export the new tables first (`npx supabase db dump --db-url "$DIRECT_URL" --data-only -f mvp-data.sql`), roll the application back (step 2), then run `docs/runbooks/backend-mvp-rollback.sql`. Tested: it restores the exact pre-upgrade schema (columns, constraints, indexes, triggers, functions, policies, grants, RLS).
4. **Data damaged:** restore a backup (Supabase restore or the dumps). **For the first release no manual backup exists** (see "Backup status"); only an automatic dashboard backup could help, and its existence was not verified.

**Limitations:**
- **Vercel Instant Rollback reverts the application only, never the database.** After a rollback the previous version (`a3b9a9f`) runs on the **new** schema. This is supported: its own test suite passed against the new schema (83 of 86; the 3 failures assert the old schema's shape, not behaviour). Differences while it runs: shipments can no longer move out of Delivered/Cancelled; the database queues notification emails that the old version never sends (see step 2).
- The schema rollback script is a separate, manual, approved step. It deletes the data of the new tables (line items, notes, replies, issue reports, contact enquiries, job runs) and request assignments; customers, staff, requests, quotes, shipments, events, documents and the audit log are kept (tested). It is safe on a database that was never upgraded or only partly upgraded (tested).
- PostgreSQL cannot remove enum values: the 5 new email statuses remain after a rollback (unused, harmless).
- Migration 2's data change (closing legacy email rows and removing a stored staff address) is not reversed by the rollback; production had no such rows.
- Supabase Auth settings and email templates are dashboard settings, not covered by SQL; change them back by hand.
- Without a manual backup, data written after the upgrade cannot be restored to an earlier point except from an automatic Supabase backup, if the plan provides one.

## Public registration closed (owner decision, 2026-11-08)
Registration stays closed until the official launch.
- **Hosted Supabase is configured in its dashboard, not from `supabase/config.toml`** (that file only configures the local stack). Changing the file does not change production.
- **Verified read-only on 2026-11-08:** the hosted project answers `disable_signup: false` on `/auth/v1/settings`, so its public Auth API still accepts sign-ups even though the website form is off.
- **To close it (needs approval, before or during the release):** Supabase dashboard → the project (ref `ygnn…`) → **Authentication → Sign In / Providers → User Signups → "Allow new users to sign up": off** → Save. Leave the **Email** provider **enabled** (it is also the login method) and leave "Confirm email" on.
- **Verify afterwards without credentials:** `GET https://<project>.supabase.co/auth/v1/settings` with the public anon key must show `"disable_signup": true`; a sign-up attempt must return HTTP 422 `signup_disabled`.
- Unaffected: existing users signing in, password reset for existing users, and staff invitations (Auth admin API).
- Tests: `tests/supabase/auth-and-rls.test.ts` (closed: sign-up refused with no account created, invitations still give the customer role, existing users sign in) and journey G (no form, Auth API refuses, existing customer signs in). The open-registration tests are kept and run automatically when sign-ups are reopened (`JOURNEY_REGISTRATION_OPEN=1` for the journey).

## Supabase Auth URLs: local versus production
The auth emails (sign-up confirmation, password reset, staff invitation) send the user to the app's callback, `GET /api/auth/callback` (`app/api/auth/callback/route.ts`). It verifies the `token_hash` (or a PKCE `code`) server-side, then redirects to a validated same-site path: `/{en|fr}/portal`, `/{en|fr}/reset-password` or `/{en|fr}/admin` only (`lib/auth/redirects.ts`).

**Redirect targets the code sends to Supabase** (all built from `SITE_URL` via `getSiteUrl()`; with `SITE_URL=https://marchelo-logistics.com`):

| Flow | Code | `redirect_to` sent to Supabase |
|---|---|---|
| Sign-up confirmation (only once registration opens) | `registerAction`, `app/[locale]/(auth)/actions.ts` | `https://marchelo-logistics.com/api/auth/callback?next=%2Fen%2Fportal` (or `%2Ffr%2Fportal`) |
| Password reset | `forgotPasswordAction`, same file | `https://marchelo-logistics.com/api/auth/callback?next=%2Fen%2Freset-password` (or `%2Ffr%2Freset-password`) |
| Staff invitation | `inviteUserAction`, `app/[locale]/admin/actions.ts` | `https://marchelo-logistics.com/api/auth/callback?next=%2Fen%2Freset-password` (or `%2Ffr%2Freset-password`, the invitation language) |

The email templates then link to `<redirect_to>&token_hash=<hash>&type=email|recovery|invite`.

**Configuration** (hosted values are set in the Supabase dashboard; `supabase/config.toml` configures **only** the local stack and is never applied to the hosted project):

| Setting | Local (`supabase/config.toml`) | Production (dashboard → Authentication → URL Configuration) |
|---|---|---|
| Site URL | `http://localhost:3000` | `https://marchelo-logistics.com` (currently not verified; to set at release) |
| Redirect URLs | `http://localhost:3000/api/auth/callback**`, `http://127.0.0.1:3000/api/auth/callback**`, `http://localhost:3200/api/auth/callback**` | `https://marchelo-logistics.com/api/auth/callback**` (exactly one entry) |
| Public sign-ups | `[auth] enable_signup = false` | "Allow new users to sign up": **off** (currently on: `disable_signup: false`) |
| Email templates | `supabase/templates/*.html` loaded from the file | paste the same three files into Email Templates |
| SMTP | local Mailpit (captures, never delivers) | custom SMTP via Resend, not yet configured |

**Why exactly this entry (verified 2026-11-08 against the local Supabase Auth server with a temporary non-loopback entry `https://glob-check.example/api/auth/callback**`):** the redirects above, with their `?next=` query, were **kept**; a different path on the same host and a `www.` host were **replaced by the Site URL**, which produces a broken link (`https://<site>&token_hash=…` without a path or `?`). So:
- the entry must end in `**` (the query string is part of the match);
- `www.marchelo-logistics.com` is not needed because links are always built from `SITE_URL` (the apex); add `https://www.marchelo-logistics.com/api/auth/callback**` only if `SITE_URL` ever uses `www`;
- the local stack also accepts any loopback host (`localhost`, `127.0.0.1`), so local tests alone cannot prove the hosted allow-list; that is why the check above used a non-loopback host.
- The Site URL also appears in the templates (logo `{{ .SiteURL }}/brand/marchelo-logo-email.png`), so it must be the official domain too.

## Customer registration (C-03) switch-on
Open registration is implemented and tested (local Supabase + journey "G (open)"). At the official launch, in this order:
1. Custom SMTP in Supabase (Authentication → SMTP), using the verified sender domain (C-02). Supabase's built-in mailer is heavily rate-limited and not meant for production; check its current terms in the dashboard.
2. Authentication → Sign In / Providers: **Allow new users to sign up: on**; Email provider **Confirm email: on**; minimum password length 12; secure password change on.
3. Authentication → Email Templates: paste `supabase/templates/confirmation.html` (Confirm sign up), `invite.html`, `recovery.html`, with the subjects in `supabase/config.toml`. The links use `token_hash`, so they work in any browser or device.
4. Authentication → URL Configuration: Site URL `https://marchelo-logistics.com`; Redirect URLs exactly `https://marchelo-logistics.com/api/auth/callback**` (see [Supabase Auth URLs](#supabase-auth-urls-local-versus-production)).
5. Authentication → Rate limits: review "emails sent per hour" for the SMTP provider.
6. Vercel Production: `ENABLE_CUSTOMER_REGISTRATION=true`, redeploy, then register with an inbox the owner controls and confirm.
To close registration again, set the flag to `false` (the form disappears) and turn sign-ups off in Supabase (the Auth API then refuses too).

## Transactional email activation checklist (prepared 2026-11-08, not applied)
Nothing below has been changed in Vercel. "Current" is what was verified read-only; Sensitive values cannot be read back.

| Variable | Intended Production value | Current in Vercel Production | Action at activation |
|---|---|---|---|
| `ENABLE_TRANSACTIONAL_EMAIL` | `false` until explicit activation, then `true` | `false` (verified) | set to `true` last |
| `STAFF_NOTIFICATION_EMAIL` | the business owner's admin Gmail address (owner decision 2026-11-08; not written in this public repository) | set, Sensitive (set to `info.cargo@marchelo-logistics.com` on 2026-11-07) | **change** |
| `EMAIL_FROM` | `Marchelo Logistics <notifications@marchelo-logistics.com>` | set, Sensitive (that value, 2026-11-07) | none |
| `EMAIL_REPLY_TO` | `info.cargo@marchelo-logistics.com` | **not set** | **add** (needs the code in this release) |
| `SITE_URL` | `https://marchelo-logistics.com` | `https://marcelo-logistics.vercel.app` | **change** |
| `RESEND_API_KEY` | existing production secret | set, Sensitive | none |
| `RESEND_WEBHOOK_SECRET` | existing production secret | set, Sensitive | none |
| `EMAIL_TEST_RECIPIENT` | never set | not set | none (ignored on Vercel anyway) |

How the code uses them:
- **Staff alerts** (all 9 templates) go only to `STAFF_NOTIFICATION_EMAIL` (comma-separated, max 10); it is resolved at send time and never stored.
- **Customer emails** go to the customer's own address stored on the request or enquiry; nothing redirects them.
- **Reply-to**: when `EMAIL_REPLY_TO` is set, it is added to every outgoing email, customer and staff, without changing the sender or the recipients.
- **Every link in every email** (buttons, tracking, signed quote links, logo, footer) is built from `SITE_URL` through `getSiteUrl()`; nothing uses `VERCEL_URL`. Until `SITE_URL` is changed, email links point to `marcelo-logistics.vercel.app`.
- **Webhook**: `/api/webhooks/resend` verifies the Svix signature with `RESEND_WEBHOOK_SECRET`. Environment variables are read at deployment time, so it answers 503 until the next production deployment and then accepts Resend's signed events with the existing secret.

Order at activation (each step needs approval):
1. Release this branch (signed commit, merge, push): the code supporting `EMAIL_REPLY_TO` must be live first.
2. In Vercel Production: change `STAFF_NOTIFICATION_EMAIL` and `SITE_URL`, add `EMAIL_REPLY_TO`.
3. Supabase Auth: Site URL and redirect URLs to the official domain, and custom SMTP (see the registration switch-on).
4. Set `ENABLE_TRANSACTIONAL_EMAIL=true` and redeploy production.
5. Check: submit a contact enquiry from an address you control, confirm the acknowledgement and the staff alert, then the Resend dashboard (delivered) and the staff Notifications page.

