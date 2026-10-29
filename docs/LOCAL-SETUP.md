# Local setup

## 1. Requirements
- Node.js 22 (the repository uses npm and `package-lock.json`).
- For database, auth and storage features: Docker Desktop and the Supabase CLI.
- Google Chrome (end-to-end tests use the installed Chrome).
- Make sure TLS certificate checking is **on**: `NODE_TLS_REJECT_UNAUTHORIZED` must not be set to `0`.

## 2. Public site only (no services)
```bash
npm ci
cp .env.example .env.local      # leave the service values empty
npm run dev                     # http://localhost:3000/en
```
Quote submission, accounts, tracking and uploads show honest "not available yet" states.

## 3. Full stack with a local Supabase
```bash
supabase init                   # once, if there is no supabase/ folder
supabase start                  # prints the local API URL, anon key and service-role key
```
Fill `.env.local` (local values only):
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`>
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
SITE_URL=http://localhost:3000
ENABLE_QUOTE_SUBMISSION=true
EMAIL_DEV_LOG=true              # records emails without sending (non-production only)
```
Then:
```bash
npm run db:migrate              # local hosts only; see DATABASE.md
npm run db:seed                 # fictitious demo users and records
npm run dev
```
Demo logins: `demo.admin@`, `demo.staff@`, `demo.customer1@`, `demo.customer2@example.test`. The password is `SEED_USER_PASSWORD` if set, otherwise the local-only default in `scripts/seed.ts`. Auth emails are captured by the local Inbucket (`http://127.0.0.1:54324`).

Optional flags: `ENABLE_CUSTOMER_REGISTRATION=true`, `ENABLE_DOCUMENT_UPLOADS=true` (uses the private `customer-documents` bucket created by the migration), `ENABLE_DEMO_DATA=true` (fictitious tracking reference `MLDEMO000001`, only when no database is configured).

## 4. Checks
```bash
npm run check                   # typecheck, lint, i18n, security, Vitest
npm run build && npm run test:e2e
```
