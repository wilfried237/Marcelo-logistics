# Local setup

## 1. Requirements
- Node.js 22 (the repository uses npm and `package-lock.json`).
- For database, auth and storage features: Docker Desktop. The Supabase CLI is a dev dependency (`npx supabase …`).
- Google Chrome (end-to-end tests use the installed Chrome).
- TLS certificate checking must be **on**: `NODE_TLS_REJECT_UNAUTHORIZED` must not be set. Check with `node -e "console.log(process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? 'unset')"`. If it prints `0`, find where it is set (shell profile, IDE launcher, system environment) and remove it there; do not work around it per command and never commit it.

## 2. Public site only (no services)
```bash
npm ci                          # also runs `prisma generate`
cp .env.example .env.local      # leave the service values empty
npm run dev                     # http://localhost:3000/en
```
Quote submission, accounts, tracking and uploads show honest "not available yet" states.

## 3. Full stack with a local Supabase
The `supabase/` folder already contains the project configuration (sign-ups off, password length 12, redirect URLs for `localhost:3000`). Supabase's own migration runner is disabled: the schema is managed by Prisma.
```bash
npx supabase start -x realtime,studio,edge-runtime,logflare,vector,imgproxy,supavisor,postgres-meta
npx supabase status -o env      # shows the LOCAL URL and keys; never paste hosted keys here
```
Fill `.env.local` (git-ignored; local values only):
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local anon key from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<local service_role key from `supabase status`>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SHADOW_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/prisma_shadow   # for db:diff only
SITE_URL=http://localhost:3000
ENABLE_QUOTE_SUBMISSION=true
EMAIL_DEV_LOG=true              # records emails without sending (non-production only)
```
Then:
```bash
npm run db:migrate              # prisma migrate deploy, local hosts only; see DATABASE.md
npm run db:seed                 # fictitious demo users and records
npm run dev
```
Demo logins: `demo.admin@`, `demo.staff@`, `demo.customer1@`, `demo.customer2@example.test`. The password is `SEED_USER_PASSWORD` if set, otherwise the local-only default in `scripts/seed.ts`. Auth emails are captured by the local inbox (`http://127.0.0.1:54324`), never delivered.

Optional flags: `ENABLE_CUSTOMER_REGISTRATION=true` (also needs sign-ups enabled in `supabase/config.toml`, owner decision C-03), `ENABLE_DOCUMENT_UPLOADS=true` (private `customer-documents` bucket), `ENABLE_DEMO_DATA=true` (fictitious tracking reference `MLDEMO000001`, only when no database is configured).

Cron endpoints locally: set `CRON_SECRET` (32+ random characters) and call `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/expire-quotes`. `/api/cron/retention` only reports (dry run).

Stop the stack with `npx supabase stop` (data is kept in Docker volumes; `--no-backup` discards it).

## 4. Checks
```bash
npm run check                   # typecheck, lint, i18n, security, Vitest
npm run test:supabase           # with the local stack running
npm run build && npm run test:e2e
```
See [TESTING.md](./TESTING.md).
