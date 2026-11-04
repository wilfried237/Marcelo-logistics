# Architecture

_Last updated: 2026-11-03 · Reflects branch `feat/royal-mail-inspired-redesign`._

## Stack (settled by the project directive)
Next.js 16.4 App Router (Turbopack builds; `proxy.ts` on the Node.js runtime) · React 19.1 · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) · next-intl (EN/FR) · Inter via `next/font` · light theme only · React Hook Form + Zod · Supabase (PostgreSQL in the EU, Auth with `@supabase/ssr`, private Storage) · Prisma ORM 7.10.1 (`@prisma/adapter-pg`, SQL migrations for RLS/triggers) · Resend + React Email · Vercel (EU region, preview only) · Vitest + PGlite · Playwright + axe. No analytics. No payments.

## Request flow
```
Browser ──► proxy.ts (Next.js 16 proxy, formerly middleware; Node.js runtime)
            ├─ per-request CSP nonce (script-src nonce + strict-dynamic; pages render dynamically)
            ├─ next-intl locale routing (pages only; /api, /_next, files excluded)
            └─ Supabase session refresh (cookies only; no authorisation here)
        ──► app/[locale]/
            (site)/   public pages: home, services, quote, track, track/[ref], about, faq, privacy, terms*, contact
            (auth)/   login, register, forgot-password, reset-password  (+ actions.ts)
            portal/   customer area: requireUser in layout AND each page
            admin/    staff area: requireRole(staff|admin); users = admin only
        ──► app/api/
            track/            public read-only lookup (allowlisted, rate-limited)
            quote/            legacy endpoint: always 503, no GET
            auth/callback/    PKCE code / token_hash verification for email links
            documents/[id]/   RLS-checked 60-second signed download URL
            cron/expire-quotes, cron/retention   Bearer CRON_SECRET; counts-only logs
```
`*` terms returns 404 until legally approved.

## Layers
| Layer | Location | Responsibility |
|---|---|---|
| Domain | `lib/domain/` | Enums, service codes, quote lifecycle table, references (crypto), Zod schemas, money (integer minor units), time-zone helpers. Pure and unit-tested |
| Configuration | `lib/config/`, `config/owner.ts` | Feature flags (default off), validated environment access, owner-controlled business facts with `{{NEEDS_OWNER}}` markers |
| Data access | `lib/db/`, `prisma/` | Prisma schema, migrations and server-only client; `withUser()` (RLS as `authenticated` + JWT subject, transaction-scoped), `withAnon()`, `withSystem()` (privileged, audited actor); DB error mapping |
| Services | `lib/services/` | Business operations, each enforcing role and ownership before the database enforces them again |
| Auth | `lib/auth/`, `lib/supabase/` | Session (validated with Supabase), role from `profiles`, guards, safe redirects |
| Email | `lib/email/` | Templates (EN/FR), delivery log, idempotent send, honest outcome |
| Storage | `lib/storage/` | Private bucket adapter (service role after checks) |
| UI | `components/app/` (shared), `components/{admin,quote,tracking,services,contact,layout}` | Accessible building blocks; Server Components by default |

## Email and notifications (2026-11-04)
```
business change (server action) ──► transaction ──► trigger app_notify_* ──► email_deliveries (PENDING)
                                                 commit
response sent ──► after(): processOutbox ──► render from current records ──► Resend (idempotency key)
daily cron /api/cron/process-emails ──► retries FAILED (backoff) ──► DEAD + staff alert after 5 attempts
Resend webhook (signed) ──► DELIVERED / BOUNCED / COMPLAINED (+ staff alert)
```

## Customer registration (C-03, 2026-11-04)
```
/register (flag on) ─► registerAction: Zod, consent, rate limits ─► supabase.auth.signUp (no session)
Supabase Auth ─► confirmation email: /api/auth/callback?next=/<locale>/portal&token_hash=…&type=email
callback ─► verifyOtp(token_hash) ─► session cookie ─► /portal      (role is always "customer": app_handle_new_user)
```

## Key design decisions
1. **Defence in depth for authorisation.** Guards in layouts and pages, role assertions in services, and RLS, column grants and triggers in PostgreSQL. App queries for signed-in users run under RLS (`withUser`).
2. **Database-enforced workflow.** Quote transitions, sent/valid-quote requirements, shipment creation from accepted quotes, immutable fields and audit records are enforced by triggers, so no code path can skip them.
3. **Honest states over fake functionality.** Every unavailable capability says so. Success is shown only after a confirmed commit. "Email sent" is shown only when the provider accepted the message.
4. **No invented business facts.** Owner-controlled values live in one place, carry markers, are hidden from visitors while unresolved, and block the launch build (`RELEASE_BUILD=true`).
5. **Persistent abuse controls.** Rate limits (quotes, tracking, sign-in, registration, password reset) and idempotency are stored in Postgres, because serverless instances do not share memory. They fail closed.
6. **Staff-entered prices only.** No pricing engine exists. Amounts are stored as integer minor units with a currency code.
7. **Prisma for data access, SQL for security.** Prisma models the tables and runs the migration history; RLS, grants, triggers and definer functions stay in reviewed SQL migrations, so no ORM path can bypass them. See [DATABASE.md](./DATABASE.md#how-prisma-interacts-with-row-level-security).

## Configuration matrix
| Capability | Requires |
|---|---|
| Accounts (portal/admin) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` |
| Quote submission | `ENABLE_QUOTE_SUBMISSION` + database + email (real or dev log) |
| Transactional email | `ENABLE_TRANSACTIONAL_EMAIL` + `RESEND_API_KEY` + `EMAIL_FROM` |
| Staff invitations, uploads | `SUPABASE_SERVICE_ROLE_KEY` (+ `ENABLE_DOCUMENT_UPLOADS` for uploads) |
| Public tracking | `DATABASE_URL` |
| Scheduled jobs | `CRON_SECRET` + database; retention deletion also needs an approved policy (L-03) and `RETENTION_EXECUTION_ENABLED=true` |

See [DATABASE.md](./DATABASE.md), [SECURITY.md](./SECURITY.md), [TESTING.md](./TESTING.md), [LOCAL-SETUP.md](./LOCAL-SETUP.md) and [DEPLOYMENT.md](./DEPLOYMENT.md).
