# Security

_Last reviewed: 2026-10-30 · Scope: full application on branch `feat/mvp-database-and-app`._

This is an engineering review, **not** a legal compliance assessment. GDPR obligations (controller identity, retention, records of processing) need owner and legal review (decisions L-02, L-03).

## Controls in place

| Area | Control | Where | Verified by |
|---|---|---|---|
| Authentication | Supabase Auth with `@supabase/ssr`; token validated server-side with `auth.getUser()` on every request that needs a user | `lib/auth/session.ts`, `lib/supabase/*` | Code review; full flow needs a Supabase project (see TESTING) |
| Authorisation (app) | `requireUser`, `requireRole`, `requireOwnership`; checked in layouts **and** pages **and** server actions; services call `assertStaff`/`assertAdmin` | `lib/auth/*`, `lib/services/*` | Integration tests |
| Authorisation (DB) | RLS on every table; column grants hide staff identifiers and storage keys; app queries run as `authenticated` with the user's JWT subject | `drizzle/0001_security_model.sql`, `lib/db/context.ts` | `tests/db/rls.test.ts` (PostgreSQL) |
| Role escalation | Role only via `admin_set_user_role()` (admin-only, last-admin protected); trigger blocks any other role change, even from the privileged connection; registration never accepts a role | migration 0001 | RLS test 6 and 9 |
| Workflow integrity | Lifecycle, sent-quote, valid-quote, accepted-quote rules enforced by triggers; `created_by` must equal the session user; server-controlled timestamps | migration 0001 | `tests/db/lifecycle.test.ts` |
| Audit | Append-only `audit_log`, written in the same transaction; personal fields redacted; UPDATE/DELETE/TRUNCATE rejected | migration 0001 | lifecycle tests |
| Public tracking | `public_track_shipment()` returns an explicit allowlist; only public events; ETA only if approved; same response for unknown references; rate-limited | migration 0001, `lib/services/tracking.ts` | RLS test 10, integration tests |
| Input validation | Zod at every server boundary (strict objects, lengths, enums, service-specific items); DB check constraints mirror limits | `lib/domain/quote-schema.ts`, schema | unit + integration tests |
| Abuse | Honeypot; persistent Postgres rate limits per client (5/h) and per email (5/day) for quotes, 30/min for tracking; identifiers hashed | `lib/services/rate-limit.ts` | integration tests |
| Idempotency | Client idempotency key on quote requests; email idempotency keys | schema, `lib/email/send.ts` | integration tests |
| Files | Content-based type detection (PDF/JPEG/PNG); 10 MB limit; sanitised names; private bucket; service role only after RLS ownership check; 60 s signed URLs; orphan cleanup | `lib/services/documents.ts` | `tests/integration/documents.test.ts` |
| Secrets | Server-only modules (`server-only`); only `SUPABASE_URL`/`SUPABASE_ANON_KEY` mapped to `NEXT_PUBLIC_*`; static check forbids service-role imports in client components and `NEXT_PUBLIC_` secret names; env errors never print values | `next.config.ts`, `scripts/check-security.mjs` | `npm run check:security` |
| Redirects | Post-login targets must be same-site, locale-prefixed, allow-listed paths | `lib/auth/redirects.ts` | 15 unit cases |
| CSRF | Server Actions (Next.js origin check); no state-changing GET handlers; legacy API write methods removed (405) | — | API route tests |
| Errors | Database errors mapped to stable codes; generic error page; no stack traces or SQL in responses | `lib/db/errors.ts`, `app/[locale]/error.tsx` | review |
| Headers | CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, COOP, `Permissions-Policy`; HSTS on HTTPS deployments; no `X-Powered-By` | `lib/security/headers.ts` | unit + E2E |
| Feature flags | All default off; demo data and preview areas never in production builds | `lib/config/flags.ts` | unit tests |
| Content integrity | No fabricated claims (static check + E2E); release builds fail while owner placeholders remain | `scripts/check-*.mjs` | quality-gate tests, E2E |

## Dependency audit (2026-10-30)
- `npm audit --omit=dev`: **0 critical, 0 high, 0 moderate, 4 low**. The low findings are one advisory chain: `deepmerge` (prototype pollution in `mergeObject`) via `html-to-text` via `@react-email/render`. It is only reached when rendering our own templates to plain text, with no untrusted merge input. **Accepted**; re-check when React Email updates.
- `npm audit` (including dev tools): additionally 4 moderate in `drizzle-kit` → `@esbuild-kit` → `esbuild` (development-server request issue). This is a local CLI only and is never deployed. Accepted for now.
- Next.js pinned at 15.5.28; `postcss` overridden to ^8.5.32 inside Next (fixes source-map file-read advisories without the Next 16 major).

## Known gaps and follow-ups
| # | Gap | Risk | Plan |
|---|---|---|---|
| G-1 | CSP `script-src` allows `'unsafe-inline'` (App Router inline bootstrap) | Medium if an XSS sink appears | Move to nonce-based CSP with dynamic rendering |
| G-2 | RLS tests ran on PGlite with a Supabase stub, not on a real Supabase stack | Low (same PostgreSQL semantics), but Supabase specifics such as `storage` were not exercised | Run `tests/db` against `supabase start` (procedure in TESTING.md) before applying migrations |
| G-3 | No automated test of the real Supabase Auth flows (sign-in, recovery, invite) | Medium | Manual test plan in TESTING.md; add E2E with a local Supabase stack |
| G-4 | Login brute force relies on Supabase's built-in auth rate limits | Low | Review Supabase auth rate-limit settings at project creation |
| G-5 | Preview deployments could be public | Medium (exposes an unfinished site) | Enable Vercel Deployment Protection (DEPLOYMENT.md) |
| G-6 | `X-Forwarded-For` is trusted for the rate-limit client key | Low on Vercel (set by the platform) | Revisit if hosting changes |
| G-7 | Expired quotes need `app_expire_quotes()` to run on a schedule | Low (acceptance already rejects expired quotes) | Configure `pg_cron` when the project is created |
| G-8 | Data retention and deletion workflows are not implemented | Compliance | Pending owner decision L-03 |
| G-9 | This development machine passes `NODE_TLS_REJECT_UNAUTHORIZED=0` to the shell (TLS checks off) | Supply-chain risk for local installs | It was unset for every npm command run in this work; the owner should remove it from whatever tool configuration sets it |
