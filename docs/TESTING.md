# Testing

| Command | What it runs | Needs |
|---|---|---|
| `npm run typecheck` | TypeScript strict mode | — |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript) | — |
| `npm run check:i18n` | EN/FR key parity, value types, empty values, ICU arguments, technical placeholders | — |
| `npm run check:owner` | Lists unresolved `{{NEEDS_OWNER}}` markers; **fails release builds** (`RELEASE_BUILD=true` or `VERCEL_ENV=production`) | — |
| `npm run check:security` | Server-only modules in client code, `NEXT_PUBLIC_` secrets, unverified claims and template leftovers, tracked env files | git |
| `npm test` | All Vitest suites (unit, database, integration) | — (PGlite runs in-process) |
| `npm run test:db` | Database suites only | — |
| `npm run build` | Production build (runs the owner and i18n checks first) | network for `next/font` |
| `npm run test:e2e` | Playwright + axe on desktop and mobile viewports | a build; Google Chrome installed |
| `npm run check` | typecheck + lint + i18n + security + Vitest | — |

## Suites

| Suite | Files | Executed against |
|---|---|---|
| Unit | `tests/unit/*.test.ts` | Node |
| Database | `tests/db/*.test.ts`: migrations, RLS (the 10 required cases and more), lifecycle and audit, constraints, references, rate limiting, seed | **Real PostgreSQL 17** in-process (PGlite) + `tests/db/supabase-stub.sql` |
| Integration | `tests/integration/*.test.ts`: quote workflow services, documents, email | PGlite via Drizzle; email provider and storage are in-memory fakes (no real recipients) |
| E2E | `tests/e2e/*.spec.ts` | Production build in Chrome; no database or Supabase configured (verifies public pages and honest unavailable states) |

## Last recorded results (2026-10-30)
- Vitest: **16 files, 150 tests passed**.
- Playwright: desktop **28 passed**; mobile **28 passed, 1 skipped** (keyboard skip-link test is desktop-only).
- typecheck, lint (0 problems), i18n (472 keys per locale), security check: passed.
- Production build: passed.

## Not executed in this environment, and how to run them
These need services that were not available (Docker daemon stopped; no Supabase project):

1. **Database suites on a real Supabase stack**
   ```bash
   supabase start                      # local Docker stack
   DIRECT_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres npm run db:migrate
   ```
   Then repeat the RLS checks with the Supabase SQL editor or `psql`, using `set local role authenticated` and `set_config('request.jwt.claims', …)` exactly as in `tests/db/harness.ts`.
2. **Auth flows (manual, local Supabase)**: register (with `ENABLE_CUSTOMER_REGISTRATION=true`), confirm via Inbucket (`http://127.0.0.1:54324`), sign in, sign out, forgot/reset password, staff invitation, and checking that a customer cannot open `/admin` (404) or another customer's `/portal/quotes/<ref>` (404).
3. **End-to-end with data**: `npm run db:seed`, set `ENABLE_QUOTE_SUBMISSION=true` and `EMAIL_DEV_LOG=true`, submit a quote, review it as `demo.staff@example.test`, send a quote, accept it as the customer, create a shipment, add a public event, then track it publicly.
4. **Storage**: with `ENABLE_DOCUMENT_UPLOADS=true`, upload and download a PDF from the portal and confirm the bucket is private.
