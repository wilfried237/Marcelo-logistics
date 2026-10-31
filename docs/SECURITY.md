# Security

_Last reviewed: 2026-10-31 · Scope: full application on branch `feat/prisma-integration-hardening`._

This is an engineering review, **not** a legal compliance assessment. GDPR obligations (controller identity, retention, records of processing) need owner and legal review (decisions L-02, L-03).

## Controls in place

| Area | Control | Where | Verified by |
|---|---|---|---|
| Authentication | Supabase Auth with `@supabase/ssr`; token validated server-side with `auth.getUser()` on every request that needs a user. Sign-ups off at the Auth server (invitation-only), minimum password 12, secure password change | `lib/auth/session.ts`, `lib/supabase/*`, `supabase/config.toml` | `tests/supabase/auth-and-rls.test.ts` (**real local Supabase Auth**) |
| Authorisation (app) | `requireUser`, `requireRole`, `requireOwnership`; checked in layouts **and** pages **and** server actions; services call `assertStaff`/`assertAdmin`. IDs and roles never come from the browser | `lib/auth/*`, `lib/services/*` | Integration tests |
| Authorisation (DB) | RLS on every table; column grants hide staff identifiers and storage keys; Prisma queries for users run as `authenticated` with the user's JWT subject in a transaction-scoped context | `prisma/migrations/20261029000001_security_model`, `lib/db/context.ts` | `tests/db/rls.test.ts` (PGlite) and `tests/supabase/*` (real stack, incl. no role/claims leak on a pooled connection) |
| ORM boundary | Prisma Client generated into a git-ignored folder, imported only by `server-only` modules; static check forbids `@/lib/generated/prisma`, `@prisma/client` and `@prisma/adapter-pg` in client components | `lib/db/*`, `scripts/check-security.mjs` | `npm run check:security` |
| Role escalation | Role only via `admin_set_user_role()` (admin-only, last-admin protected, serialised with an advisory lock); trigger blocks any other role change, even from the privileged connection; registration never accepts a role | migrations | RLS tests; concurrent mutual demotion on two real sessions |
| Workflow integrity | Lifecycle, sent-quote, valid-quote, accepted-quote rules enforced by triggers; compare-and-set transitions; server-controlled timestamps | migrations, `lib/services/quote-requests.ts` | `tests/db/lifecycle.test.ts`, real-stack workflow test |
| Audit | Append-only `audit_log`, written in the same transaction; personal fields redacted; UPDATE/DELETE/TRUNCATE rejected | migrations | lifecycle tests |
| Public tracking | `public_track_shipment()` returns an explicit allowlist; only public events; ETA only if approved; same response for unknown references; rate-limited | migrations, `lib/services/tracking.ts` | RLS tests, real-stack test |
| Abuse | Honeypot; persistent Postgres rate limits (identifiers hashed with `RATE_LIMIT_SALT`, fail closed): quotes 5/h per client and 5/day per email; tracking 30/min per client; sign-in/registration 20 per 10 min per client and 10 per 10 min per email; password reset 3/h per email (limited resets still answer "check your email", so nothing is revealed) | `lib/services/rate-limit.ts`, `lib/services/auth-limits.ts` | integration tests |
| Idempotency | Client idempotency key on quote requests; email idempotency keys | schema, `lib/email/send.ts` | integration tests |
| Files | Uploads **disabled** by flag. When enabled: content-based type detection (PDF/JPEG/PNG), 10 MB limit, sanitised names, private bucket, service role only after RLS ownership check, 60 s signed URLs, orphan cleanup | `lib/services/documents.ts` | `tests/integration/documents.test.ts`; bucket privacy on the real stack |
| Scheduled jobs | `/api/cron/*` require `Authorization: Bearer $CRON_SECRET` (≥ 32 chars, timing-safe); disabled without a secret; counts-only logs. Retention deletes nothing without an approved policy **and** an explicit flag | `lib/services/jobs.ts`, `lib/services/retention.ts` | `tests/integration/jobs.test.ts`, real-stack overlap test |
| Secrets | Server-only modules; only `SUPABASE_URL`/`SUPABASE_ANON_KEY` reach the browser; static check forbids service-role imports in client components and `NEXT_PUBLIC_` secret names; env errors never print values | `next.config.ts`, `scripts/check-security.mjs` | `npm run check:security` |
| Redirects | Post-login targets must be same-site, locale-prefixed, allow-listed paths | `lib/auth/redirects.ts` | unit tests |
| CSRF | Server Actions (Next.js origin check); no state-changing GET handlers except authenticated cron jobs; legacy API write methods removed (405) | — | API route tests |
| Cookies | Supabase session cookies set by `@supabase/ssr` (HttpOnly not applicable to its design; `SameSite=Lax`, `Secure` on HTTPS) | `lib/supabase/*` | review |
| Errors | Database errors mapped to stable codes; generic error page; no stack traces or SQL in responses | `lib/db/errors.ts`, `app/[locale]/error.tsx` | review |
| Headers | **Nonce-based CSP** per request: `script-src 'self' 'nonce-…' 'strict-dynamic'`, no `'unsafe-inline'` for scripts (style-src keeps it for React/Radix style attributes); `frame-ancestors 'none'`, `object-src 'none'`; `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, COOP, `Permissions-Policy`; HSTS on HTTPS; no `X-Powered-By` | `middleware.ts`, `lib/security/headers.ts` | unit tests; E2E checks every script carries the nonce and pages hydrate with no CSP violation |
| Feature flags | All default off; demo data and preview areas never in production builds | `lib/config/flags.ts` | unit tests |
| Content integrity | No fabricated claims (static check + E2E); release builds fail while owner placeholders remain | `scripts/check-*.mjs` | quality-gate tests, E2E |

## Dependency audit (2026-10-31)
- `npm audit --omit=dev` and `npm audit` (all dependencies): **0 critical, 0 high, 0 moderate, 4 low**, both run with TLS certificate validation enabled. The low findings are one advisory chain: `deepmerge` (prototype pollution in `mergeObject`) via `html-to-text` via `@react-email/render`, reached only when rendering our own templates. **Accepted**; re-check when React Email updates.
- The earlier moderate `esbuild` findings came from `drizzle-kit`, which has been removed with Drizzle.
- Next.js pinned at 15.5.28; `postcss` overridden to ^8.5.32 inside Next.

## Known gaps and follow-ups
| # | Gap | Status / plan |
|---|---|---|
| G-1 | CSP allowed inline scripts | **Closed**: nonce-based CSP |
| G-2 | RLS only tested on PGlite | **Closed**: also tested on a real local Supabase stack. Hosted project still untested (R-02) |
| G-3 | Real Supabase Auth flows untested | **Mostly closed**: sign-in, wrong password, password policy, recovery tokens (single use), sign-out revocation, invitation and sign-up rejection tested on the local Auth server. Email *delivery* to a real inbox is untested (no verified domain, C-02) |
| G-4 | Login brute force relied only on Supabase limits | **Closed**: app-level persistent limits added. Review Supabase's own limits at project creation |
| G-5 | Preview deployments could be public | Open: enable Vercel Deployment Protection (DEPLOYMENT.md) |
| G-6 | `X-Forwarded-For` trusted for the rate-limit client key | Low on Vercel (set by the platform). Revisit if hosting changes |
| G-7 | Quote expiry needed a schedule | **Closed in code**: protected cron endpoint + `vercel.json`. Needs `CRON_SECRET` on the deployment |
| G-8 | No retention workflow | **Infrastructure in place** (dry run by default); no periods until L-03 is decided |
| G-9 | This machine sets `NODE_TLS_REJECT_UNAUTHORIZED=0` | Open, owner action. Source found: the VS Code process environment (not the Windows registry or VS Code settings). Restart VS Code from a clean environment and check for the variable in shell profiles/launchers. No TLS override is committed in the repository |
