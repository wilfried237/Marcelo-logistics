# Implementation Status

_Last updated: 2026-10-31_

**Overall: locally verified. Not preview-ready** until the owner decisions and external configuration below are done. Not production-ready.

## Branches
| Branch | Base | Content | Pushed? |
|---|---|---|---|
| `phase-0-stabilisation` | `master` | Phase 0 (stable checkpoint, `6d97295`) | No (local only) |
| `feat/mvp-database-and-app` | `phase-0-stabilisation` | Database, data layer, auth, email, pages, portal, staff area, tests, docs (on Drizzle) | No (local only) |
| `feat/prisma-integration-hardening` | `feat/mvp-database-and-app` | Prisma ORM replaces Drizzle; real local Supabase tests; role-change race fix; cron expiry and retention; auth rate limits; nonce CSP; cookie hardening; docs | No (local only) |

The intended integration is a pull request per branch to `master`, in order. Nothing has been merged, pushed, force-pushed or deployed, and no history was rewritten.

## Stages
| Stage | Status | Evidence |
|---|---|---|
| Database architecture | ✅ Prisma schema + 4 migrations; **not applied to any hosted project** | `prisma/`; no drift; PGlite and real local Supabase tests |
| Data access (Prisma) | ✅ All services on Prisma Client; RLS via transaction-scoped `withUser` | `lib/db`, `lib/services`; integration and real-stack tests |
| Authentication | ✅ Tested on the **local** Supabase Auth server (sign-in, recovery, sign-out, invitation, sign-up refused) and in a browser (journeys) | `tests/supabase`, `scripts/verify-local-journeys.mjs` |
| Authorisation | ✅ Guards + services + RLS; customer/staff/admin boundaries verified in a browser | journeys 18/18 |
| Quote operations and tracking | ✅ Full workflow under RLS on the real local stack; public submission **disabled** until prerequisites are met | DEPLOYMENT.md flag table |
| Scheduled jobs | ✅ Expiry (idempotent, overlap-safe, audited) and retention (dry-run, no periods until L-03) | `tests/integration/jobs.test.ts`, real-stack overlap test |
| Email | ✅ Implemented; tested with a **mocked** provider only; real sending **disabled** (C-02) | `tests/integration/email.test.ts` |
| Documents | ✅ Implemented; uploads **disabled** (L-03); bucket privacy verified on the local stack | `tests/integration/documents.test.ts`, `tests/supabase` |
| Security hardening | ✅ Nonce CSP, auth/quote/tracking limits, HttpOnly/Secure session cookies, headers, audit | SECURITY.md |
| Public website | ✅ EN/FR complete; owner placeholders hidden from visitors | E2E + axe |
| Frontend redesign (branch `feat/frontend-landing-and-pages`) | ✅ Logo palette (ink + logo blue), new landing page, new “How it works” and “Shipping guide” pages, banner style on content pages, real operation photos (A-02 to confirm), original SVG illustrations, sitemap and production-only robots | Playwright 76 passed, 2 skipped; axe on new pages |

## Tests executed (2026-10-31)
| Check | Result | Runs against |
|---|---|---|
| Vitest default | ✅ 17 files, 163 tests | Node + PGlite (real Postgres SQL, emulated Supabase); email/storage mocked |
| `npm run test:supabase` | ✅ 2 files, 14 tests | **Real local Supabase** (Docker) |
| Local journeys | ✅ 18/18 | Chrome + production build + real local Supabase |
| Playwright | ✅ 58 passed, 2 skipped | Chrome + production build, no services |
| typecheck / lint | ✅ / 0 problems | |
| check:i18n / check:security | ✅ 472 keys per locale / OK | |
| check:owner | ⚠️ 11 unresolved markers (expected; release builds fail by design) | |
| prisma validate / db:diff | ✅ valid / empty migration | |
| build | ✅ | |
| npm audit (all and `--omit=dev`) | ✅ 4 low, nothing higher (accepted, SECURITY.md) | |

**Not tested against real external providers:** Resend email delivery, a hosted Supabase project, Vercel (crons, Deployment Protection, EU region).

## Security findings
See [SECURITY.md](./SECURITY.md). Open: preview protection (G-5, needs Vercel), `X-Forwarded-For` trust (G-6, low), the TLS override on this machine (G-9, owner action: it comes from the VS Code process environment; restart VS Code from a clean environment).

## Outstanding owner decisions
See [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md). Block a **public release**: B-01 name, B-02 legal entity, S-01 services, C-01 contact details, L-01 terms, L-02 privacy controller, A-01 logo, R-03 launch. Block **a protected preview with features on**: R-01 accounts/region, R-02 migration approval, P-01 reviewer, C-02 email domain, L-03 retention (uploads and retention deletion), C-03 registration.

## Required external configuration
1. Supabase project in an EU region (R-01), the approved migration (R-02), Auth settings and first admin (DATABASE.md, DEPLOYMENT.md).
2. Vercel project with EU functions, preview-only env vars (incl. `CRON_SECRET`, `RATE_LIMIT_SALT`) and Deployment Protection.
3. Resend account with a verified sending domain (DNS on the owner's domain; C-02).

## Next concrete tasks
1. Owner: answer the ★ decisions in DECISIONS-REQUIRED.md; approve accounts and region (R-01); remove the machine TLS override.
2. Review the SQL in `prisma/migrations/` and give R-02 approval; then create the protected preview (DEPLOYMENT.md).
3. Enable quote submission on the preview once email and a reviewer are in place.
4. Replace `{{NEEDS_OWNER}}` values as answers arrive (`npm run check:owner`).
5. FR copy review by a fluent speaker.
