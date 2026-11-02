# Database

PostgreSQL on Supabase (EU region, owner decision R-01), accessed with **Prisma ORM 7.10.1** (`prisma-client` generator, `@prisma/adapter-pg`). Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`. Configuration: `prisma.config.ts`.

> **Status:** the migrations have **not been applied to any shared or hosted Supabase project**. They were applied and tested against (a) in-process PostgreSQL 17 (PGlite) with a Supabase stub (`tests/db`) and (b) a **real local Supabase stack** started with the official CLI in Docker (`tests/supabase`). Applying them to a hosted project requires owner approval (R-02).

## Tables

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; holds `role` (`customer`, `staff`, `admin`) | Created by trigger on sign-up. Role changes only via `admin_set_user_role()` |
| `customers` | Contact details of whoever requested a quote; `user_id` links to a login | Email stored lower-case (CHECK) and **not unique**: anonymous requests are never auto-linked to accounts by email |
| `quote_requests` | Requests (`QR` + 6 base32) with service code, route, JSONB `items`, status, locale | `items` must be a JSON array of 1–50 entries, ≤ 32 KB; service-specific shape validated by Zod |
| `quotes` | Staff-entered quotes: `amount_minor` (bigint), `currency` (`EUR`, `XAF`), validity, inclusions/exclusions | Frozen once `sent_at` is set |
| `shipments` | `ML` + 10 base32 reference; owner and service derived from the accepted quote | ETA shown to customers only if `eta_visible` |
| `shipment_events` | Milestone code, location, time, EN/FR notes, `public` flag | Non-public events are internal working notes |
| `documents` | Metadata for private files in the `customer-documents` bucket | `retention_until` stays NULL until a policy is approved (L-03) |
| `audit_log` | Append-only change history | Written only by triggers/definer functions |
| `rate_limits` | Fixed-window counters | **Why:** serverless instances do not share memory; keys are hashed |
| `email_deliveries` | Transactional email log | **Why:** report "sent" only when the provider accepted, and make retries idempotent |

Money uses integer minor units with an ISO 4217 code (EUR has 2 decimals, XAF has 0). Delete rules are `RESTRICT` for business, financial, shipment and audit history; only `profiles` follows its auth user.

## Prisma and the SQL migrations

Prisma owns the **table model and the migration history**; PostgreSQL owns the **security model**. Everything Prisma cannot express stays in SQL inside the Prisma migration folders: RLS policies, column grants, triggers, `SECURITY DEFINER` functions, the audit trigger, the lifecycle rules, last-admin protection, the Storage bucket.

| Migration | Content |
|---|---|
| `20261029000000_initial_schema` | Enums, tables, checks, FKs, indexes (originally generated, reviewed; kept byte-for-byte) |
| `20261029000001_security_model` | Hand-written, idempotent: functions, triggers, RLS, grants, private bucket (only if the `storage` schema exists) |
| `20261031000000_customers_email_index` | Lower-cases stored emails, adds `customers_email_lowercase` CHECK, replaces the expression index with `customers_email_idx` so Prisma can model it |
| `20261031000100_admin_role_serialisation` | `admin_set_user_role()` takes a transaction advisory lock, so two concurrent demotions cannot remove the last admin |

- `auth.users` is declared in the schema as an **external table** (`tables.external` in `prisma.config.ts`, `experimental.externalTables`) so relations type-check but Prisma never creates or alters it.
- `prisma/shadow-init.sql` creates the Supabase roles and a stub `auth.users`/`auth.uid()` in the shadow database, so drift checks can replay the migrations outside Supabase.
- Drift check: `npm run db:diff` (from the migration history to `schema.prisma`) must print an **empty migration**. Last run: empty (no drift).
- `prisma/migrations/.gitattributes` pins line endings to LF so checksums are identical on every OS.
- The Prisma Client is generated into `lib/generated/prisma` (git-ignored; `postinstall` and `prebuild` run `prisma generate`). It is imported only from `server-only` modules; `npm run check:security` fails if a client component imports it.

## How Prisma interacts with Row Level Security

The app connects with a privileged database role (Supabase `postgres` via the pooler), which **bypasses RLS**. RLS is therefore applied explicitly per request in `lib/db/context.ts`:

| Helper | What it does | Used for |
|---|---|---|
| `withUser(db, userId, fn)` | Interactive `$transaction`: `set_config('request.jwt.claims', {"sub": userId, "role": "authenticated"}, true)` then `SET LOCAL ROLE authenticated` | Every query made for a signed-in user |
| `withAnon(db, fn)` | Same, as `anon` | Public tracking (`public_track_shipment()` only) |
| `withSystem(db, actor, fn)` | Privileged transaction that records the acting user for the audit trigger | Anonymous quote submission, rate limits, email log, scheduled jobs, reads already authorised under RLS |

- `userId` comes only from the server-validated Supabase session (`auth.getUser()`), never from the browser; it is checked to be a UUID before use.
- `set_config(..., true)` and `SET LOCAL` are **transaction-scoped**, so the role and claims are discarded at commit/rollback and cannot leak to the next request on a pooled connection (verified in `tests/supabase/prisma-services.test.ts`).
- Under `authenticated`, column grants hide some columns (`created_by`, `storage_key`, …). Queries in that context use an explicit `select`; a `select *` would fail with "permission denied", which is the intended behaviour.
- Domain errors raised by triggers (`ML_…` codes) and unique violations are mapped by `lib/db/errors.ts`, which understands both PostgreSQL codes and Prisma/driver-adapter error shapes (`P2002`, `23505`).

## Quote lifecycle

```
SUBMITTED -> UNDER_REVIEW -> AWAITING_CUSTOMER -> QUOTED -> ACCEPTED | DECLINED | EXPIRED
             UNDER_REVIEW -> QUOTED                (staff can quote without asking for more information)
        AWAITING_CUSTOMER -> UNDER_REVIEW          (review resumes after the customer replies)
        AWAITING_CUSTOMER -> QUOTED                (information received by phone/email)
any status except CANCELLED -> CANCELLED           (reason required, 1–500 characters)
```

- The table lives in `lib/domain/quote-lifecycle.ts` **and** in `app_quote_transition_allowed()`; a test checks every pair is identical.
- The trigger `app_enforce_quote_request_rules` rejects any other change, requires a **sent** quote for `QUOTED` and a **still-valid** quote for `ACCEPTED`, and blocks edits to identity fields.
- Services apply transitions with a compare-and-set (`updateMany where { id, status: current }`), so two staff members cannot both move the same request.
- Who may do what: staff/admin for review and cancellation (RLS `quote_requests_staff_update`); the owning customer for accept/decline through `customer_respond_to_quote()`; `EXPIRED` only through `app_expire_quotes()` (the protected cron job, below).
- Every change writes an `audit_log` row **in the same transaction** (`app_audit_row` trigger), so a status change can never succeed without its audit record.

## Access model (Row Level Security)

| Role | Access |
|---|---|
| `anon` | No table privileges at all. Only `public_track_shipment(text)` |
| `authenticated` customer | Own `customers` row, own requests, **sent** quotes, own shipments, **public** events, own documents |
| `authenticated` staff/admin | All operational records; inserts/updates allowed by policy; audit log read |
| admin only | `admin_set_user_role()` (cannot remove the last admin; serialised with an advisory lock) |
| `service_role` | Bypasses RLS. Used server-side only for Storage and invitations, always after application checks. Never in client code |

Helper functions (`app_current_role`, `app_is_staff`, `app_is_admin`, `app_owns_customer`) are `SECURITY DEFINER` with `search_path = ''`, so policies never recurse. Verified on the local Supabase stack: RLS enabled on 10/10 tables, 19 policies, 20 triggers, 0 table grants to `anon`, private bucket with no client policies.

## Scheduled jobs

| Endpoint | Does | Auth |
|---|---|---|
| `GET /api/cron/expire-quotes` | Runs `app_expire_quotes()`: moves `QUOTED` requests whose sent quote has passed `valid_until` to `EXPIRED`, audited. Idempotent and safe to overlap (row locks; tested with concurrent runs) | `Authorization: Bearer $CRON_SECRET` (≥ 32 chars, timing-safe). Without the secret: `503 CRON_DISABLED` |
| `GET /api/cron/retention` | Dry run by default: reports counts that **would** be deleted. Deletes only with `?mode=execute` **and** an approved policy in `config/retention.ts` **and** `RETENTION_EXECUTION_ENABLED=true` | Same |

The retention policy has **no periods** (`approved: false`, all periods `null`) until the owner decides (L-03); the job refuses to delete anything until then. Logs contain counts only, never personal data. `vercel.json` schedules only the expiry job (daily, the Vercel Hobby limit); Vercel runs crons on production deployments only.

## Migration procedure

- **Local** (disposable Supabase stack): `npm run db:migrate`. The wrapper `scripts/db-migrate.mjs` refuses any non-local host unless `ALLOW_MIGRATE_HOST` equals that host, then runs `prisma migrate deploy` with `DIRECT_URL`. Because Supabase pre-creates the `auth`/`storage` schemas, it creates Prisma's history table first when `public` is empty (otherwise `P3005`). Re-running is a no-op (tested).
- **New schema changes:** edit `schema.prisma`, run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` to produce SQL, put it in a new timestamped folder, review it, and add any RLS/grants/triggers by hand in the same migration. Migrations must not contain destructive statements; a test enforces this.
- **Never** run `prisma db push` or `prisma migrate dev` against a shared or hosted database. `migrate dev` needs a shadow database and may propose resets; use it only against a disposable local database (`SHADOW_DATABASE_URL`).
- **Rollback:** Prisma has no down-migrations. Roll back by writing a new forward migration that reverses the change, reviewed like any other. For a failed deploy, `prisma migrate resolve --rolled-back <name>` after fixing the database by hand. Take a Supabase backup (or PITR point) before every hosted migration.

### Applying to Supabase after approval (R-02)
1. Create the project in the approved EU region. Note the **direct** connection string (port 5432) and the **pooled** one (port 6543).
2. Review the SQL in `prisma/migrations/*/migration.sql`.
3. Take a backup, then run `DIRECT_URL=… ALLOW_MIGRATE_HOST=<db host> npm run db:migrate`, and `npm run db:status` to confirm.
4. Auth settings (dashboard → Authentication), matching `supabase/config.toml`: public sign-ups **off** unless C-03 opens registration, email provider on, minimum password length 12, secure password change on, Site URL and redirect allow-list `https://<host>/api/auth/callback`.
5. Bootstrap the first administrator in the Supabase SQL editor (trusted path):
   ```sql
   begin;
   select set_config('app.role_change', 'allowed', true);
   update public.profiles set role = 'admin' where id = '<auth user uuid>';
   commit;
   ```
6. Set `CRON_SECRET` in Vercel so the expiry job runs.

## Seed (local only)
`npm run db:seed` creates fictitious users (`demo.*@example.test`) and demo records in every workflow stage. It refuses non-local `SUPABASE_URL`/`DIRECT_URL`. The seed logic (`scripts/seed-data.ts`) is executed in tests against PostgreSQL.

## Test coverage (executed)
- `tests/db/*.test.ts`: PGlite (PostgreSQL 17 in WebAssembly) served over the Postgres wire protocol (`@electric-sql/pglite-socket`), so the **real Prisma Client** runs against it, with `tests/db/supabase-stub.sql` emulating `auth.users`, `auth.uid()` and the API roles.
- `tests/supabase/*.test.ts`: the **real local Supabase stack** (GoTrue Auth, PostgREST, Storage, Postgres 17). See [TESTING.md](./TESTING.md).
