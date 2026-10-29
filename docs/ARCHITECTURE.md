# Marcel Logistics — Technical Architecture Recommendation

_Last updated: 2026-10-29 · Status: **proposal**. Items marked "needs sign-off" require owner approval (cost or vendor) before implementation._

Related: [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md) · [IMPLEMENTATION-ROADMAP.md](./IMPLEMENTATION-ROADMAP.md)

## 1. Principles

1. **Evolve, don't rebuild.** Keep Next.js App Router, TypeScript strict mode, Tailwind 4, shadcn/ui and next-intl. No new framework.
2. **Server is the source of truth.** Validation, authorisation and (eventually) pricing happen on the server. The browser only displays.
3. **Honest by default.** No fabricated data paths. If a capability doesn't exist yet, the UI says so and offers a human channel.
4. **Request-a-quote first.** Staff review every quote. Automatic pricing is a later, separately approved module that plugs into the same quote records.
5. **Bilingual from the data model up.** Statuses and milestones are enum codes translated in the UI, never English strings stored in the DB.
6. **Least vendor lock-in.** Prefer Postgres, open-source libraries and providers with data export.
7. **Reversible steps.** Every phase ships behind a PR, with versioned, non-destructive migrations and no production changes without approval.

## 2. Technical decisions

Each decision covers the recommendation, the trade-offs, the costs to verify, the dependencies, and the consequences of choosing an alternative.

> **Costs:** vendor prices change often, so no figures are quoted here. Each entry says *what* drives cost and *where* to verify. Check the vendor's current pricing page before sign-off.

### 2.1 D-17: Framework version (Phase 0)
- **Recommendation:** upgrade `next` and `eslint-config-next` **15.5.0 → 15.5.28** (latest 15.5 patch). Bump `react` and `react-dom` to the latest **19.1.x** (19.1.10), `next-intl` within 4.x (4.14.9), and `zod` within 4.x (4.6.7). Transitive fixes (postcss, sharp, nanoid, source-map-js) arrive through these bumps or `npm audit fix` (non-force).
- **Why:** 15.5.0 is affected by 4 **critical** advisories (RCE in the React flight protocol; RCE in the image optimiser for AVIF and SVG; RCE on Windows-hosted servers) and many high-severity ones. `npm audit` names 15.5.28 as the fix.
- **Trade-offs:** a patch upgrade carries low risk. next-intl 4.3 → 4.14 is a larger minor jump and may change middleware behaviour, so verify the locale redirects.
- **Costs:** none.
- **Dependencies:** R-12 (TLS checking disabled in this environment) should be resolved before installing packages.
- **Alternative: Next 16.x now.** It brings middleware/proxy and caching changes that would expand Phase 0 into a migration. **Consequence:** more regression risk before tests exist. Do it after Phase 1, once E2E tests exist.

### 2.2 D-16: Hosting (staging now, production later)
- **Recommendation:** **Vercel** for the Next.js app, with a preview deployment per PR and functions pinned to an EU region. Production domain cut-over only after D-20 (WordPress migration plan) is approved.
- **Trade-offs:** first-class Next.js support (image optimisation, server actions, preview URLs for owner review). Cost scales with usage and team seats; the commercial-use terms of the free tier must be checked.
- **Costs to verify:** plan required for commercial use, function execution, bandwidth, team seats (vercel.com/pricing).
- **Dependencies:** a Git hosting account the owner controls; env variables; D-20 for the domain.
- **Alternative A: existing Hostinger hosting** (currently runs WordPress, PHP). Next.js needs a Node runtime, which may need a VPS plan. **Consequence:** we would manage Node, process restarts, TLS and updates ourselves, with no preview deployments.
- **Alternative B: a VPS or container platform** (e.g. Fly.io, Railway, Render). **Consequence:** more control, more operations work; Docker configuration needed.

### 2.3 D-9: Database and ORM (Phase 3)
- **Recommendation:** **PostgreSQL** in an **EU region** with **Drizzle ORM** and versioned SQL migrations (`drizzle-kit generate` and review; never `push` against shared environments).
  - Host: **Neon** if the app is on Vercel (serverless driver, branch-per-PR databases for testing), or **Supabase** if bundled storage and auth are preferred.
- **Trade-offs:** Drizzle is lightweight, has SQL-like queries and small bundles, and its migrations are plain SQL that can be reviewed. Its ecosystem is younger than Prisma's.
- **Costs to verify:** storage, compute hours, backups and point-in-time-restore retention on the chosen tier (neon.tech/pricing or supabase.com/pricing).
- **Dependencies:** D-16 (region co-location); a backup policy; the GDPR data-retention decision (D-25).
- **Alternative A: Prisma.** Mature tooling and Studio GUI. **Consequence:** heavier client and generated engine; equally valid; switching later costs a rewrite of the data layer.
- **Alternative B: Supabase all-in-one** (DB + Auth + Storage). **Consequence:** fewer vendors; more coupling to Supabase APIs and row-level-security patterns; auth (D-11) is effectively decided too.
- **Alternative C: MySQL on the existing Hostinger plan.** **Consequence:** usually not reachable from serverless hosts; weaker fit.

### 2.4 D-11: Authentication (Phase 6)
- **Recommendation:** **Better Auth** (or **Auth.js v5**), self-hosted, with sessions in our Postgres.
  - **Customers:** email + password and/or magic link. Quoting and tracking remain possible **without an account**.
  - **Staff:** invite-only, with roles `staff` and `admin`.
  - Authorisation is checked in server code (layouts, server actions, queries). Middleware only handles redirects.
- **Trade-offs:** no per-user fees and no external user store. We own security updates and email verification flows (which need D-10).
- **Costs:** none for the library. Email sending volume applies.
- **Dependencies:** D-9 (DB), D-10 (email for verification and reset). Builds on the uncommitted `(auth)` route group (D-19).
- **Alternative A: Clerk.** Fastest to integrate, polished UI. **Consequence:** monthly cost scales with active users; user data held by a third party (DPA needed); vendor lock-in.
- **Alternative B: Supabase Auth.** Natural if D-9 = Supabase. **Consequence:** ties identity to Supabase.

### 2.5 D-10: Transactional email (Phase 5)
- **Recommendation:** **Resend** with **React Email** templates (EN and FR), sending from a subdomain of the owner's domain (e.g. `notify.<domain>`) with SPF, DKIM and DMARC records.
- **Trade-offs:** simple API, good Next.js fit. Alternatives offer stronger deliverability track records for transactional mail.
- **Costs to verify:** monthly send volume tiers, number of domains (resend.com/pricing).
- **Dependencies:** **DNS access** for the domain (currently managed with the WordPress/Hostinger setup, D-20); D-1 (domain).
- **Alternative A: Postmark.** Excellent deliverability, transactional focus. **Consequence:** similar integration effort; different pricing model.
- **Alternative B: AWS SES.** Lowest unit cost. **Consequence:** more setup (sandbox exit, bounce handling).
- **Alternative C: SMTP via the existing mailbox** (e.g. Gmail). **Consequence:** sending limits, poor deliverability, credentials on the server. Not recommended.

### 2.6 D-25: File storage (Phase 5)
- **Recommendation:** private **S3-compatible** bucket (Cloudflare R2, or Supabase Storage if D-9 = Supabase). Uploads use pre-signed URLs; MIME, extension and size are checked server-side; files are served only through short-lived signed URLs to authorised users.
- **Trade-offs:** R2 has no egress fees. Supabase Storage keeps everything in one vendor.
- **Costs to verify:** storage per GB-month, operations, egress.
- **Dependencies:** D-25 (which documents, retention period), D-11 (who may view).
- **Alternative: storing files in the database or on the server disk.** **Consequence:** doesn't work on serverless hosting; bloats backups.

### 2.7 D-14: Abuse protection (Phase 0 / 4)
- **Recommendation:** honeypot field, server-side validation (Zod), and rate limiting per IP and per email (Postgres-backed, or Upstash Redis if needed). Add **Cloudflare Turnstile** only if spam appears.
- **Trade-offs:** no third-party script by default (privacy, performance), but weaker against targeted bots.
- **Costs:** none by default; Turnstile is free at the time of writing (verify).
- **Alternative: reCAPTCHA.** **Consequence:** Google cookies require a consent banner.

### 2.8 D-13: Analytics (Phase 2)
- **Recommendation:** cookieless analytics (Vercel Web Analytics or Plausible), or none at launch.
- **Alternative: Google Analytics 4.** **Consequence:** consent banner required (GDPR/ePrivacy); more legal text (D-8).

### 2.9 D-24 / D-15: Typography and theme (Phase 1)
- **Recommendation:** **Inter** (variable) through `next/font/google`, self-hosted at build time. Light theme only, with tokens kept dark-ready.
- **Alternative:** Source Sans 3 or Manrope (equally valid); dark mode at launch doubles the visual QA.

### 2.10 Testing and CI (Phase 1 onward)
- **Recommendation:** GitHub Actions (or the Git host's CI) running `tsc`, ESLint (+ `eslint-plugin-jsx-a11y`), an i18n key-parity script, **Vitest** (unit), **Playwright** (E2E with `@axe-core/playwright`, desktop + mobile viewports) and `next build` on every PR.
- **Costs:** CI minutes (free tiers usually suffice; verify).
- **Alternative: manual testing only.** **Consequence:** regressions such as the API routing bug ship unnoticed. That bug has existed since `c42a872`.

## 3. Ongoing cost checklist (verify before sign-off)

| Item | Cost driver | Needed from |
|---|---|---|
| App hosting | Plan tier for commercial use, function time, bandwidth, seats | Staging (Phase 1) |
| Database | Storage, compute, backup retention | Phase 3 |
| Email sending | Monthly volume, domains | Phase 5 |
| File storage | GB-month, operations, egress | Phase 5 |
| Error monitoring (Sentry or similar) | Events per month | Phase 3+ |
| Domain and DNS | Annual renewal (already paid by the owner?) | Existing |
| WhatsApp Business API (optional) | Per-conversation fees + provider | Phase 7 (D-12) |
| Payments (optional) | Per-transaction fees | Phase 10 (D-7) |

## 4. Target architecture

```
                     ┌──────────────────────── Next.js 15 (App Router) ────────────────────────┐
Browser ── EN/FR ──► │ middleware: locale only (excludes /api, /_next, files)                  │
                     │                                                                          │
                     │ app/[locale]/(marketing)  Server Components, static where possible       │
                     │ app/[locale]/quote        RSC page + client form island ─► Server Action │
                     │ app/[locale]/track/[ref]  RSC, public limited view                       │
                     │ app/[locale]/(auth)       login / register / reset                        │
                     │ app/[locale]/(portal)     customer, session required                     │
                     │ app/[locale]/(admin)      staff/admin, role required                     │
                     │ app/api/*                 only public read APIs + webhooks               │
                     └──────────┬───────────────────────────────┬──────────────────────────────┘
                                │                               │
            lib/domain (enums, references, types)       lib/auth (session, roles)
            lib/schemas (Zod, shared client/server)      lib/email (React Email EN/FR)
            lib/quotes (request-a-quote workflow)        lib/storage (signed URLs)
            lib/pricing (DEFERRED, D-5)                  lib/db (Drizzle schema + migrations)
                                │
                        PostgreSQL (EU) ── backups
```

### 4.1 Request-a-quote workflow (approved interim model, D-6)

```
Customer submits request ─► status SUBMITTED ─► email to staff + confirmation to customer (ref QR-XXXXXX)
Staff opens request     ─► UNDER_REVIEW (may ask for info ─► AWAITING_CUSTOMER)
Staff enters price(s)   ─► QUOTED (amount, currency, inclusions/exclusions, valid until)
Customer responds       ─► ACCEPTED ─► booking/shipment created (Phase 7)
                        └► DECLINED │ EXPIRED (automatic after valid-until)
Staff may CANCEL at any stage (reason required). Every transition is written to audit_log.
```
- Prices are entered **by staff**, as decimal amounts with a currency code. There is no automatic calculation.
- A future `lib/pricing` may *suggest* a price to staff first, before any customer-facing automation (requires D-5).
- Customer confirmation copy promises no response time unless D-3 is confirmed.

### 4.2 Core data model (Phase 3 draft)

| Table | Key fields |
|---|---|
| `customers` | id, name, email, phone, preferred_locale, created_at |
| `quote_requests` | id, reference (`QR-` + 6 random base32), customer_id, service_code, origin_country, destination_country, destination_city, items (jsonb, validated per service), notes, status, locale, created_at |
| `quotes` | id, quote_request_id, amount_minor, currency, inclusions, exclusions, valid_until, created_by, sent_at |
| `shipments` | id, reference (`ML-` + random), quote_id, service_code, status, eta_from, eta_to |
| `shipment_events` | id, shipment_id, milestone_code, location, occurred_at, note_en, note_fr, public (bool), created_by |
| `documents` | id, owner type/id, storage_key, mime, size, uploaded_by, retention_until |
| `users` / `sessions` / `accounts` | from the auth library; `users.role` ∈ customer, staff, admin |
| `audit_log` | actor, action, entity, entity_id, before/after (jsonb), at |

- References are random and non-sequential (they can't be enumerated); public tracking requires the full reference.
- Money is stored as integer minor units plus an ISO currency code.

### 4.3 Security baseline
- Zod validation on every server action and route handler; lengths, ranges and enums enforced.
- Authorisation in the data-access layer (`requireRole`, `requireOwnership`), not only middleware.
- No listing endpoints without auth; public endpoints return minimal fields.
- Security headers in `next.config.ts`: CSP (nonce-based once scripts are known), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`; `poweredByHeader: false`.
- Secrets only in environment variables, documented in `.env.example`, never committed.
- Dependency audit in CI; Renovate/Dependabot for patches.
