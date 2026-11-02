# Testing

| Command | What it runs | Needs |
|---|---|---|
| `npm run typecheck` | TypeScript strict mode | — |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript) | — |
| `npm run check:i18n` | EN/FR key parity, value types, empty values, ICU arguments, technical placeholders | — |
| `npm run check:owner` | Lists unresolved `{{NEEDS_OWNER}}` markers; **fails release builds** (`RELEASE_BUILD=true` or `VERCEL_ENV=production`) | — |
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
| check:owner | 9 unresolved owner markers (expected; release builds fail by design) |
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
