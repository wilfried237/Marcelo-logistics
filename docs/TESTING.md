# Testing

| Command | What it runs | Needs |
|---|---|---|
| `npm run typecheck` | TypeScript strict mode | — |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript) | — |
| `npm run check:i18n` | EN/FR key parity, value types, empty values, ICU arguments, technical placeholders | — |
| `npm run check:owner` | Lists unresolved `{{NEEDS_OWNER}}` markers; **fails the launch build** (`RELEASE_BUILD=true`); warns on every other build, including Vercel production | — |
| `npm run check:security` | Server-only modules (incl. Prisma Client) in client code, `NEXT_PUBLIC_` secrets, unverified claims and template leftovers, tracked env files | git |
| `npm run db:validate`, `npm run db:diff` | Prisma schema validation; drift between migration history and schema (must print an empty migration) | `db:diff` needs `SHADOW_DATABASE_URL` (local) |
| `npm test` | All default Vitest suites (unit, database, integration) | — (PGlite runs in-process) |
| `npm run test:db` | Database suites only | — |
| `npm run test:supabase` | Real local Supabase stack suites | `supabase start`, migrated, `.env.local` with local values. Refuses non-local hosts |
| `npm run build` | Production build (runs `prisma generate`, the owner and i18n checks first) | network for `next/font` |
| `npm run test:e2e` | Playwright + axe on desktop and mobile viewports | a build; Google Chrome installed |
| `node scripts/verify-local-journeys.mjs` | Sign-in, cookies, role-based access, sign-out in Chrome against a local build on the local Supabase stack | seed + build + `next start -p 3100`. Local URLs only |
| `npm run check` | typecheck + lint + i18n + security + Vitest | — |

On machines with little free memory run Vitest with `--maxWorkers=1` (each PGlite instance uses several hundred MB).

## Suites and what they run against

| Suite | Files | Executed against | Kind |
|---|---|---|---|
| Unit | `tests/unit/*.test.ts` | Node | Pure logic, headers/CSP, cookies options, quality gates |
| Database | `tests/db/*.test.ts`: migrations (Prisma history, idempotency, no destructive SQL), RLS, lifecycle and audit, constraints, references, rate limiting, seed | **PostgreSQL 17 in-process (PGlite)** served over the wire protocol, so the **real Prisma Client** connects; `tests/db/supabase-stub.sql` emulates Supabase roles and `auth` | Real SQL, emulated Supabase |
| Integration | `tests/integration/*.test.ts`: quote workflow services, documents, email, cron auth, quote expiry, retention, auth rate limits | PGlite via Prisma. **Email provider and storage are in-memory fakes**: no message is sent, no file leaves the process | Mocked providers |
| Real Supabase | `tests/supabase/*.test.ts`: Auth (sign-up refused, sign-in, wrong password, password policy, single-use recovery tokens, sign-out revocation, invitation → customer role), RLS isolation and hidden columns, anon denial, public tracking, Storage privacy, concurrent last-admin protection, full Prisma workflow under RLS, overlapping expiry runs, no role/claims leak on a pooled connection | **Real local Supabase stack** (official CLI, Docker): GoTrue, PostgREST, Storage, Postgres 17 | Real services, local only |
| E2E | `tests/e2e/*.spec.ts` | Production build in Chrome, **no** database or Supabase configured (public pages, honest unavailable states, nonce CSP, axe) | Browser |
| Journeys | `scripts/verify-local-journeys.mjs` | Production build + real local Supabase, seeded demo users | Browser, real local services |

**Not tested against any real external provider:** email delivery (Resend; no verified domain, C-02), hosted Supabase (no approved project, R-01/R-02), Vercel Cron and Deployment Protection.

## Last recorded results (2026-11-03, branch `feat/royal-mail-inspired-redesign`, Next.js 16.4.4)
| Check | Result |
|---|---|
| Vitest default suites | **17 files, 163 tests passed** (unit 9 files / 78; database 4 / 46; integration 4 / 39) |
| `npm run test:supabase` | **2 files, 14 tests passed** on the real local stack |
| Playwright | **80 passed, 4 skipped** (desktop + mobile; the 4 skips are tests that only apply to the other viewport) |
| Local journeys | **18/18 passed** (customer, staff, admin; HttpOnly + SameSite=Lax cookies; staff 404 on admin-only page; sign-out) |
| typecheck, lint | pass, 0 problems |
| check:i18n | OK, 561 keys per locale |
| check:security | OK |
| check:owner | 9 unresolved owner markers (expected; the `RELEASE_BUILD=true` launch build fails by design) |
| `prisma validate`, `db:diff` | valid; empty migration (no drift) |
| `npm run build` | pass |
| `npm audit` | 4 low, 0 moderate/high/critical (SECURITY.md) |

## Running the real-stack checks
```bash
npx supabase start -x realtime,studio,edge-runtime,logflare,vector,imgproxy,supavisor,postgres-meta
npx supabase status -o env          # copy the LOCAL values into .env.local (see LOCAL-SETUP.md)
npm run db:migrate                  # local hosts only
npm run test:supabase
npm run db:seed && npm run build && npx next start -p 3100
node scripts/verify-local-journeys.mjs
npx supabase stop                   # when finished
```
Auth emails sent by the local stack are captured by its Inbucket/Mailpit inbox (`http://127.0.0.1:54324`), never delivered.

## Backend MVP suites (2026-11-04)
| Suite | Runs against | Result |
|---|---|---|
| `npm test` (unit 11 files, database 4, integration 6) | Node + PGlite; email provider mocked in-process | **210 passed** |
| `npm run test:supabase` | real local Supabase (Docker) | **14 passed** |
| `npm run test:e2e` | production build, no services | **82 passed, 4 skipped** (viewport-specific) |
| `npm run test:journeys` (new) | production build + **real local Supabase** + the app's real email code talking to a **local mock of the Resend API** (`tests/e2e-fullstack/mock-resend.mjs`; nothing leaves the machine) | **6 passed**: A request, B staff quotation, C acceptance via signed link, D shipment, E public tracking, F failures (provider outage, retry job, forged webhook, access control) |

New test files: `tests/unit/pricing.test.ts`, `tests/integration/email.test.ts` (outbox, retries, concurrency, webhooks), `tests/integration/mvp-workflow.test.ts`, `tests/integration/email-previews.test.ts` (every template in EN/FR; set `EMAIL_PREVIEW_DIR` to write the HTML/text for review), `tests/e2e-fullstack/journeys.spec.ts`.

Running the journeys: `npx supabase start …`, `npm run db:migrate`, `npm run db:seed`, `npm run build`, `npm run test:journeys` (refuses a non-local database).

**Not tested against real providers:** Resend delivery, SPF/DKIM, real webhooks (no domain or account yet, C-02).

## Final verification run (2026-11-04)
All against local or in-process services only (PGlite, local Supabase in Docker with its Mailpit, a local mock of the Resend API). Guards refuse non-local database or Supabase URLs; no test references a hosted endpoint.

| Check | Result |
|---|---|
| `npm test`: unit 11 files, database 5, integration 6 | **219 passed** (incl. new `tests/db/upgrade-rehearsal.test.ts`: production-state upgrade + tested rollback) |
| `npm run test:supabase` (real local Auth/PostgREST/Storage/Postgres + Mailpit) | **16 passed** (open registration: verification, cross-device link, no privilege escalation, duplicate sign-up) |
| `npm run test:e2e` (production build, services blanked) | **82 passed, 4 skipped** (viewport-specific) |
| `npm run test:journeys` A–G | **7 passed** (G: register → confirm by email link → portal; F now asserts real 404s) |
| typecheck, lint, `check:i18n` (852 keys EN/FR), `check:security` (incl. `.env.example` guard), `check:owner` (8 markers, allowed until launch) | pass |
| `npm run build` | pass (deploy-migrate skipped: not a Vercel production build) |
| `prisma validate`, `npm run db:diff` | valid; no drift |
| `npm audit` | 4 low (production deps), 16 moderate (dev only); unchanged |

Isolation fix: the public E2E suite previously inherited `.env.local` through `next start`, so it only passed while the local stack was stopped. It now blanks the service variables (`playwright.config.ts`) and uses port 3300, never the journeys' 3200.
Journeys clean up stale queued emails left by other local suites before starting (local database only).

## Live email run (manual, real Resend)
`tests/live-email/all-scenarios.live.ts` drives every email scenario through the real services, triggers, outbox and Resend API, using fictitious data in a throwaway PostgreSQL (PGlite). It never runs with `npm test`; start it with `npx vitest run --config vitest.live-email.config.mts` and:
- `ENABLE_TRANSACTIONAL_EMAIL=true`, a **temporary** sending-only `RESEND_API_KEY` (delete it afterwards), `EMAIL_FROM`, `STAFF_NOTIFICATION_EMAIL` (a placeholder);
- `EMAIL_TEST_RECIPIENT` **and** `LIVE_EMAIL_EXPECTED_RECIPIENT` set to the same test inbox (otherwise every scenario is skipped); optional `LIVE_EMAIL_REPORT` (JSON of what was sent, intended recipients masked) and `LIVE_EMAIL_ONLY` (regex of scenario names to run).

Safeguards: the override is ignored on Vercel; the run refuses to start unless the override matches the expected inbox; a provider wrapper aborts any send that is not to that single address with `[EMAIL TEST]` in the subject. Customer emails go out in French and English, staff alerts once each; failures are simulated with a fake provider, never with real addresses.

Result on 2026-11-08: 52 emails, all 13 customer templates in EN and FR plus all 9 staff alert templates and their variants, every one **delivered** (Resend status) to the single test inbox.

