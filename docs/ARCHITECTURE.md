# Architecture

_Last updated: 2026-10-30 · Reflects the implemented MVP on `feat/mvp-database-and-app`._

## Stack (settled by the project directive)
Next.js 15.5 App Router · React 19.1 · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) · next-intl (EN/FR) · Inter via `next/font` · light theme only · React Hook Form + Zod · Supabase (PostgreSQL in the EU, Auth with `@supabase/ssr`, private Storage) · Drizzle ORM + `drizzle-kit` · Resend + React Email · Vercel (EU region, preview only) · Vitest + PGlite · Playwright + axe. No analytics. No payments.

## Request flow
```
Browser ──► middleware.ts
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
```
`*` terms returns 404 until legally approved.

## Layers
| Layer | Location | Responsibility |
|---|---|---|
| Domain | `lib/domain/` | Enums, service codes, quote lifecycle table, references (crypto), Zod schemas, money (integer minor units), time-zone helpers. Pure and unit-tested |
| Configuration | `lib/config/`, `config/owner.ts` | Feature flags (default off), validated environment access, owner-controlled business facts with `{{NEEDS_OWNER}}` markers |
| Data access | `lib/db/` | Drizzle schema and client; `withUser()` (RLS as `authenticated` + JWT subject) and `withSystem()` (privileged, audited actor); DB error mapping |
| Services | `lib/services/` | Business operations, each enforcing role and ownership before the database enforces them again |
| Auth | `lib/auth/`, `lib/supabase/` | Session (validated with Supabase), role from `profiles`, guards, safe redirects |
| Email | `lib/email/` | Templates (EN/FR), delivery log, idempotent send, honest outcome |
| Storage | `lib/storage/` | Private bucket adapter (service role after checks) |
| UI | `components/app/` (shared), `components/{admin,quote,tracking,services,contact,layout}` | Accessible building blocks; Server Components by default |

## Key design decisions
1. **Defence in depth for authorisation.** Guards in layouts and pages, role assertions in services, and RLS, column grants and triggers in PostgreSQL. App queries for signed-in users run under RLS (`withUser`).
2. **Database-enforced workflow.** Quote transitions, sent/valid-quote requirements, shipment creation from accepted quotes, immutable fields and audit records are enforced by triggers, so no code path can skip them.
3. **Honest states over fake functionality.** Every unavailable capability says so. Success is shown only after a confirmed commit. "Email sent" is shown only when the provider accepted the message.
4. **No invented business facts.** Owner-controlled values live in one place, carry markers, are hidden from visitors while unresolved, and block release builds.
5. **Persistent abuse controls.** Rate limits and idempotency are stored in Postgres, because serverless instances do not share memory.
6. **Staff-entered prices only.** No pricing engine exists. Amounts are stored as integer minor units with a currency code.

## Configuration matrix
| Capability | Requires |
|---|---|
| Accounts (portal/admin) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` |
| Quote submission | `ENABLE_QUOTE_SUBMISSION` + database + email (real or dev log) |
| Transactional email | `ENABLE_TRANSACTIONAL_EMAIL` + `RESEND_API_KEY` + `EMAIL_FROM` |
| Staff invitations, uploads | `SUPABASE_SERVICE_ROLE_KEY` (+ `ENABLE_DOCUMENT_UPLOADS` for uploads) |
| Public tracking | `DATABASE_URL` |

See [DATABASE.md](./DATABASE.md), [SECURITY.md](./SECURITY.md), [TESTING.md](./TESTING.md), [LOCAL-SETUP.md](./LOCAL-SETUP.md) and [DEPLOYMENT.md](./DEPLOYMENT.md).
