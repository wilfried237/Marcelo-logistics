# Marcel Logistics — Implementation Roadmap

> **Historical planning document (2026-10-29).** Current status is in [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md); open owner questions are in [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md). Decision IDs of the form D-nn used below were renumbered there.


_Audit date: 2026-10-29 · Branch audited: `master` @ `dff3ca7` plus uncommitted working-tree changes_

Companion documents:
- [UI-UX-AUDIT.md](./UI-UX-AUDIT.md): detailed interface audit
- [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md): prioritised decision register, risks and dependencies
- [OWNER-QUESTIONNAIRE.md](./OWNER-QUESTIONNAIRE.md): questions for the business owner
- [ARCHITECTURE.md](./ARCHITECTURE.md): technical recommendations with trade-offs
- [PHASE-0-PLAN.md](./PHASE-0-PLAN.md): Phase 0 tasks and acceptance criteria
- [PHASE-1-REDESIGN-SPEC.md](./PHASE-1-REDESIGN-SPEC.md): route-by-route redesign specification

> **Update 2026-10-29 (after owner review):**
> - The quotation model is **request-a-quote with staff-reviewed quotes**. Automatic pricing is deferred until approved rate data exists (D-5). Phase 4 below is amended accordingly.
> - The Next.js security fix target is **15.5.28**.
> - A live WordPress site already serves `marchelo-logistics.com` (Hostinger). No deployment or DNS change is made without an approved migration plan (D-20).
> - Where this roadmap and the newer documents differ, the newer documents take precedence.

> **Status of this document:** this is the audit and planning phase only. No application code was changed. Phase 0 should not start until this roadmap has been reviewed.

---

## 0. Executive summary

The repository is a **front-end prototype**. It has no database, authentication, email, file storage, tests or deployment configuration. Every "data" feature is either mocked in the browser or held in server memory.

The most important finding is that **quote submission and shipment tracking are broken on `master` today.** Commit `c42a872` added next-intl middleware whose matcher also catches `/api/*`. As a result, every API request is redirected to `/en/api/...` and returns 404. This was verified against a local production build (see §11).

The foundations are worth keeping: Next.js 15 App Router, TypeScript strict mode, Tailwind 4, shadcn/ui, and next-intl with complete EN/FR key parity. Much of the content is placeholder template material, though: shadcn demo testimonials, an "Acme Inc" dashboard, "Your Company" on the login page, and a "Shadcnblocks.com" copyright. The brand name is also spelt three different ways.

**Recommendation:** keep the stack and evolve it in place. Stabilise first (Phase 0), then build a real design system, and only then add a data layer, auth and real workflows.

---

## 1. Current architecture

### 1.1 Verified stack (from `package.json` and installed `node_modules`)

| Concern | Report claim | Actual (installed) | Notes |
|---|---|---|---|
| Framework | Next.js 15.5 App Router | **next 15.5.0** (Turbopack for dev and build) | Has a **critical** advisory per `npm audit`; patch release available (15.5.28) |
| UI runtime | React 19 | **react 19.1.0** | |
| Language | TypeScript | **TypeScript 5.9.2**, `strict: true` | `tsc --noEmit` passes |
| Styling | Tailwind CSS 4 | **tailwindcss 4.1.12** via `@tailwindcss/postcss` | No `tailwind.config`; tokens in CSS. Legacy v3 `@tailwind` directives still present |
| Components | shadcn/ui + Radix | shadcn "new-york" style, **neutral** base colour, 19 primitives in `components/ui` | `components.json` points to `app/globals.css`, but the real file is `app/[locale]/globals.css` |
| Animation | Framer Motion | framer-motion 12.23.16 | Used in 12 files and heavily on the homepage |
| Forms | react-hook-form + Zod | Installed but **unused**. `ui/form.tsx` is never imported; zod and `@hookform/resolvers` have zero imports | Every form uses `useState` with no validation |
| i18n | next-intl | next-intl 4.3.9, `en` / `fr`, `localePrefix: "always"` | Moderate advisory |
| Icons | — | lucide-react **and** react-icons (react-icons only for one WhatsApp icon) | |
| Package name | — | `"name": "my-app"` | Template default |

**Missing entirely:** database or ORM, auth library, email provider, file storage, payments, test runner, CI, deployment configuration (`vercel.json`, Dockerfile), `.env.example`, error monitoring, analytics.

### 1.2 Runtime topology (today)

```
Browser ──► middleware.ts (next-intl, matcher catches EVERYTHING incl. /api)
              │
              ├─ /{en|fr}/*  → app/[locale]/**  (almost all "use client" pages)
              └─ /api/*      → 307 → /en/api/* → 404   ❌ (bug)

app/api/quote/route.ts   in-memory array (lost on restart / per serverless instance)
app/api/track/route.ts   hard-coded object with 2 fake shipments, mutable via unauthenticated POST
```

### 1.3 Git state at audit time

- Branches: `master` (current) and `Feat-implementing-functionalities` (local and remote). The feature branch is an **ancestor** of master (`9bfb32d`), so it contains no unmerged work.
- **Uncommitted work, preserved and untouched:**
  - `D app/[locale]/login/page.tsx`: moved into a route group
  - `?? app/[locale]/(auth)/layout.tsx`, `(auth)/login/page.tsx`, `(auth)/register/page.tsx`: new auth route group
  - `M middleware.ts`: whitespace-only change
- Commit messages are mostly descriptive. `445c541 "Sure! Pl"` is a truncated AI-tool message.

---

## 2. Existing routes and components

### 2.1 Routes

| Route | File | Rendering | State |
|---|---|---|---|
| `/` | (middleware) | 307 → `/en` | OK |
| `/[locale]` | `app/[locale]/page.tsx` | `"use client"` | Marketing homepage, placeholder content |
| `/[locale]/quote` | `app/[locale]/quote/page.tsx` | client | Form plus live estimate; **submit broken** |
| `/[locale]/track` | `app/[locale]/track/page.tsx` | client | Search UI; **API unreachable**, so every lookup shows "not found" |
| `/[locale]/portal` | `app/[locale]/portal/page.tsx` | client | Hard-coded mock data, **public**, English only |
| `/[locale]/dashboard` | `app/[locale]/dashboard/page.tsx` | server | Untouched shadcn `sidebar-07` demo, **public** |
| `/[locale]/login` | `app/[locale]/(auth)/login/page.tsx` _(uncommitted)_ | server | Template; form does nothing |
| `/[locale]/register` | `app/[locale]/(auth)/register/page.tsx` _(uncommitted)_ | server | Exact copy of login |
| `GET/POST /api/quote` | `app/api/quote/route.ts` | node | In-memory; GET lists **all** quotes with customer PII, no auth |
| `GET/POST /api/track` | `app/api/track/route.ts` | node | Two fake shipments; POST lets anyone append events |
| _missing_ | — | — | Service pages, about, contact page, FAQ, prohibited items, terms, privacy, cookies, 404/500 pages, `sitemap`, `robots` |

### 2.2 Components

| Component | Used by | Notes |
|---|---|---|
| `navbar1.tsx` | root layout | shadcnblocks template. Logo loads from a **third-party CDN** (`deifkwefumgah.cloudfront.net`). Login and sign-up link to `#`. Links are not locale-aware; uses raw `<a>`. Menu descriptions are web-agency copy ("Clean, brand-aligned, responsive design") |
| `navigation.tsx` | **unused** | Second, competing navbar implementation |
| `language-switcher.tsx` | navbar | Works. Shows a 🇺🇸 flag for English (business is in Ireland) |
| `quote-calculator.tsx` | quote page | Holds the **client-side pricing tables**. All UI strings hard-coded in English |
| `contact2.tsx` | homepage | Contact details are real-looking. The form has no `<form>` element and no submit handler. `<h1>` inside the homepage (two H1s) |
| `footer.tsx` | homepage only | Template copy ("Components made easy.", "© 2024 Shadcnblocks.com"); every link `#`; logo is a pulsing skeleton |
| `testimonials.tsx` | homepage | Six fabricated SaaS testimonials marked "Verified Customer"; avatar images don't exist (`/avatars/*.jpg`) |
| `float_Whatsapp.tsx` | root layout | Works; no accessible name |
| `login-form.tsx` | auth pages | Fake submit (3 s timeout). "Continue with Vercel / Next.js" buttons |
| `custom-image-uploader.tsx` | **unused** | Leaks object URLs (`createObjectURL` every render, never revoked); `next/image` used without width and height |
| `app-sidebar.tsx`, `nav-main.tsx`, `nav-projects.tsx`, `nav-user.tsx`, `team-switcher.tsx` | dashboard | shadcn demo data ("Acme Inc", "Evil Corp.", "shadcn / m@example.com") |
| `animated-card/section/text.tsx` | homepage | `AnimatedText` builds words in `useEffect`, so **SSR outputs an empty `<h1>`**. `AnimatedSection direction="left"` causes horizontal page overflow |
| `components/ui/*` | various | Standard shadcn; `ui/form.tsx` unused |
| `hooks/use-mobile.ts` | `ui/sidebar` | Standard |

---

## 3. Current design system

- **Tokens:** the default shadcn **neutral grayscale** palette in OKLCH (`--primary: oklch(0.205 0 0)`, i.e. near-black). There is no brand colour, no semantic success, warning or info tokens, and chart tokens are unused. A `.dark` theme is defined, but nothing toggles it.
- **Typography:** `--font-sans: var(--font-geist-sans)` is referenced, but **Geist is never loaded** (`next/font` is absent), so text falls back to the browser default. There is no type scale: sizes are ad hoc (`text-5xl md:text-7xl`, `text-3xl`, `text-xl`...).
- **Colour usage:** raw Tailwind palette colours bypass the tokens (`text-gray-600`, `bg-green-100`, `bg-gray-50`, `text-red-600`, `bg-green-500`). Status colours are duplicated in `portal` and `track`.
- **Spacing and layout:** a custom `.container` in `@layer components` overrides Tailwind's utility. Pages nest `container` inside `container`. Section padding varies from `py-16` to `py-32`.
- **Motion:** almost every element animates, and nothing respects `prefers-reduced-motion`. The hero waits ~1.2–2 s before it becomes visible.
- **Assets:** `public/LOGO.png` exists, but the navbar uses an external placeholder logo. `work1.jpeg` and `work2.jpeg` have alt text "Demo".

Conclusion: there is effectively **no design system yet**, only shadcn defaults.

---

## 4. Feature inventory

Legend: ✅ working · 🟡 implemented, unverified · 🟠 partial · 🎭 mock only · ❌ missing · 💥 broken · ❓ needs owner confirmation

| Feature | Status | Evidence / notes |
|---|---|---|
| EN/FR routing and switching | ✅ | `/en`, `/fr` return 200; switcher works; 176 keys in each locale file with full parity |
| Translation coverage | 🟠 | Portal, quote calculator, login, dashboard, `navigation.tsx` and the uploader are hard-coded English. 15 FR values are identical to EN (some are fine, e.g. "Services") |
| Homepage marketing content | 🎭 | Stats ("50+ countries", "1000+ shipments", "99%"), case study, testimonials and the "Sarah Johnson" quote are unverified or fabricated ❓ |
| Contact details | ❓ | IE `+353 89 616 0927`, CM `+237 695 739 033`, a personal Gmail address (not a domain address; since replaced), site `marchelo-logistics.com` |
| Contact form | 💥 | No `<form>`, no handler, no endpoint |
| WhatsApp button | ✅ | Opens `wa.me/+353896160927` |
| Quote: live estimate | 🟡 | Client-side calculator works, but the prices are invented ❓ |
| Quote: submission | 💥 | `/api/quote` is unreachable (middleware). When reached, it stores data in memory only, sends no email, and returns a fake tracking number |
| Quote: file upload | ❌ | `files` exists in state, but no input field is rendered; the server reads only metadata |
| Quote: validation | ❌ | Server accepts negative weight, invalid email and HTML in names; no Zod |
| Pricing parity (client vs server) | 💥 | Two independent tables (§5.2) |
| Booking | ❌ | Booking number generated at quote time; no booking flow |
| Tracking: public lookup | 💥 | API unreachable, so the UI always shows "not found", even for the demo numbers |
| Tracking: data | 🎭 | Two hard-coded shipments (Dublin→New York, Cork→London, both outside the IE→CM business focus). GET **invents** an "In transit" event on each request older than 2 h |
| Tracking: timeline icons | 💥 | API returns icon **names** (`"Ship"`), but the page renders `event.icon` as a component, so the icons never show |
| Customer portal | 🎭 | Hard-coded data, public, English only. Settings, filter, track, invoice, view and book buttons have no handlers |
| Staff dashboard | 🎭 | Unmodified shadcn demo; public; the site navbar overlaps the sidebar |
| Authentication | 🎭 | Two identical template pages; no provider, no sessions, no route protection. Uncommitted route-group work in progress |
| Accounts / roles | ❌ | |
| Pricing admin / rate tables | ❌ | |
| Financial records / invoices | ❌ | Buttons only |
| Email notifications | ❌ | No provider; no env variables |
| Online payments | ❌ | Future (owner said so) |
| Services: parcels, personal effects | 🟠 | "Parcel" type only ❓ |
| Services: barrels and boxes | ❌ | ❓ |
| Services: air freight | 🟠 | "Air Express" type ❓ |
| Services: sea freight / containers | 🟠 | "Container" type; no FCL/LCL distinction ❓ |
| Vehicle transport | 🟠 | "Car" type, weight ignored ❓ |
| Commercial cargo | 🟠 | Generic "Freight" ❓ |
| Routes (IE→CM, other African) | ❓ | Origin hard-coded to "Ireland"; 80+ worldwide destinations listed, including duplicates ("madagascar"/"malagasy", "congo"/"congo kinshasa"/"congo brazzaville") and **Sri Lanka under "Africa"** |
| Legal pages (terms, privacy, cookies) | ❌ | Footer links to `#` |
| SEO (metadata, sitemap, OG, hreflang) | 🟠 | One static English title "Marchelo Logistics"; hero H1 empty in SSR HTML |
| Accessibility | 🟠 | See the UI/UX audit |
| Tests | ❌ | None |
| CI / deployment | ❌ | None in repo |

---

## 5. Technical debt

### 5.1 Blocking bugs
1. **Middleware intercepts API routes.** `middleware.ts:9` uses the matcher `/((?!_next|.*\\..*).*)`. It should exclude `api` (for example `/((?!api|_next|_vercel|.*\\..*).*)`).
2. **Tracking icon type mismatch.** `app/[locale]/track/page.tsx:260` renders `event.icon` as a component, but the API sends a string.
3. **Hero H1 is empty on SSR.** `components/animated-text.tsx` sets its words in `useEffect`. It also renders a `<div>` inside an `<h1>` (invalid nesting).
4. **Horizontal overflow** on the homepage: `scrollWidth` 1571 vs `clientWidth` 1521, caused by `AnimatedSection direction="left"` with `x: 50`.

### 5.2 Pricing discrepancy (frontend vs backend)
| Aspect | `components/quote-calculator.tsx` (shown to user) | `app/api/quote/route.ts` (stored) |
|---|---|---|
| Destinations | 80+ entries | 8 entries; all others use the default |
| Cameroon multiplier | **4.0** | **2.0** (default) |
| UK multiplier | 1.2 | 1.2 |
| Volume surcharge | €50/m³ for parcel and air (only if the user types `×`, not `x`) | none |
| Rounding | `Math.round` | none (floats such as `100.000001` possible) |
| Delivery estimate | fixed days per type | days × destination multiplier, as a date |

Example: a 10 kg parcel to Cameroon at 50×40×30 cm is shown as **€203** but stored as **€100**. Neither figure comes from the business. **Pricing must have a single, server-authoritative implementation.**

### 5.3 Structural debt
- Almost every page is `"use client"`, which loses SSR, SEO and server data fetching. The homepage needs no client state beyond animation.
- Two navbar components; duplicated `getStatusColor` in portal and track; duplicated login and register pages.
- Shared domain types (`Shipment`, `Quote`, `TrackingEvent`) are redeclared in four files with different shapes.
- Status values are free-form English strings (`"In Transit"`), not an enum. They can't be translated.
- In-memory "database" with module-level mutable state. Under serverless, each instance has its own copy and data is lost on cold start.
- `(auth)/layout.tsx` hides the global navbar with a global `style jsx` that matches any `nav` or `header`. That is fragile, and it will hide navigation inside auth pages too. A proper route-group layout split is the fix.
- `window.location.href = "/"` in the quote success screen drops the locale and forces a full reload.
- Non-locale-aware links (`<a href="/quote">`) everywhere. next-intl's `createNavigation` `Link` should be used.
- Legacy Tailwind v3 `@tailwind base/components/utilities` directives in a v4 stylesheet.
- `components.json` CSS path is wrong, so future `shadcn add` runs will write to a non-existent file.
- README is the create-next-app boilerplate.

### 5.4 Unused or unnecessary dependencies
- `zod`, `@hookform/resolvers`, `react-hook-form`: **keep**, and actually use them in Phase 1+.
- `react-icons`: used for one icon; replace with an inline SVG or simple-icons and drop it.
- `components/navigation.tsx`, `components/custom-image-uploader.tsx`, `components/ui/form.tsx`: unused today. **Do not delete yet.** `ui/form.tsx` will be used, and the uploader can be repaired in Phase 5.

### 5.5 Lint and type status
- `tsc --noEmit`: 0 errors.
- `npm run lint`: 0 errors, 5 warnings (unused `getStatusIcon`, unused `error`, 3× `<img>`).

---

## 6. Security risks

| # | Severity | Risk | Location |
|---|---|---|---|
| S1 | **Critical** | `next 15.5.0` has a critical advisory; 7 vulnerable production packages in total (next, next-intl, zod, postcss, sharp, nanoid, source-map-js) | `package.json`. Upgrade within 15.5.x first |
| S2 | **High** | `GET /api/quote` returns **every** quote with customer name, email and phone, unauthenticated, filterable by email. This is a GDPR exposure the moment it is reachable | `app/api/quote/route.ts:134` |
| S3 | **High** | `POST /api/track` lets anyone change any shipment's status and location | `app/api/track/route.ts:196` |
| S4 | **High** | Portal and dashboard are publicly routable; no auth exists | `app/[locale]/portal`, `dashboard` |
| S5 | Medium | No server-side input validation (types, ranges, lengths, email format). Values are stored as given | `app/api/quote/route.ts` |
| S6 | Medium | Predictable identifiers: `ML` + last 9 digits of `Date.now()`, and the same timestamp for tracking and booking. Enumerable; collides under concurrency | `app/api/quote/route.ts` |
| S7 | Medium | No rate limiting or bot protection on public forms (quote, contact, tracking lookup) | — |
| S8 | Medium | Server-side price is trusted for storage, but the client shows a different price. Once payments exist, only the server price may be charged | §5.2 |
| S9 | Low | No security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy); `X-Powered-By: Next.js` exposed | `next.config.ts` |
| S10 | Low | Third-party hot-linked logo (`cloudfront.net`) | `components/navbar1.tsx` |
| S11 | Low | Tracking GET mutates server state and fabricates events, so customers could be shown false information | `app/api/track/route.ts:177` |
| S12 | Future | File uploads will need type and size limits, malware scanning, private storage and signed URLs | — |

No `.env*` files exist, and `process.env` is never read, so no secrets are present in the repository. `.gitignore` correctly ignores `.env*`.

---

## 7. UI/UX problems (summary)

The full audit is in [UI-UX-AUDIT.md](./UI-UX-AUDIT.md). Headlines:
1. The homepage reads as a generic template. Nothing says "Ireland ⇄ Cameroon", barrels, vehicles or personal effects.
2. The hero is invisible for ~1–2 s, empty without JavaScript, and its words run together.
3. The primary CTAs ("Get Started", "View Services", "Learn More") are not links and do nothing.
4. Fabricated testimonials and stats damage trust and may breach consumer-protection rules.
5. The quote page shows an empty calculator first, puts shipment type in a separate column from the details, gives no inline validation, and shows no error when submission fails.
6. Tracking has no milestones and no clear "what happens next", and always errors today.
7. Portal, dashboard and login are untranslated, unprotected templates.
8. No brand colour, no loaded font, no type scale; inconsistent spacing.
9. Accessibility gaps: icon-only links without names, two H1s, no reduced-motion support, no visible error association.

---

## 8. Recommended architecture

Keep the existing framework. Only add what is needed, phase by phase. Final choices marked ❓ are in DECISIONS-REQUIRED.md.

| Layer | Recommendation | Rationale |
|---|---|---|
| Framework | **Next.js 15 App Router (keep)**. Upgrade to the latest 15.5.x patch now; evaluate 16 later | No reason to switch |
| Rendering | Server Components by default; client components only for interactive islands (forms, switcher, calculator) | SEO, performance, secure data access |
| Mutations | **Server Actions** for forms, plus Route Handlers only for public or external APIs (tracking lookup, webhooks) | Fewer endpoints; built-in CSRF protection for actions |
| Validation | **Zod** schemas in `lib/schemas/*`, shared by client (react-hook-form) and server | Already installed |
| Database | **PostgreSQL** (managed: Neon, Supabase or RDS) ❓ | Relational data (customers, quotes, shipments, events, invoices) |
| ORM / migrations | **Prisma** (decided; replaced the interim Drizzle layer on 2026-10-31), with versioned migrations and never destructive auto-push in production | Type safety; reviewable migrations |
| Auth | **Auth.js v5** or **Better Auth** ❓ with email magic link and password, and roles `customer`, `staff`, `admin`. Protection enforced in the data layer, not only in middleware | Self-hosted, no per-user fees |
| Pricing | A single `lib/pricing/` module fed by **database rate tables** (route × service × weight/volume bands, surcharges, currency, validity dates). The client calls a server action for the estimate | Fixes §5.2; staff can edit prices |
| Tracking | `shipments` + `shipment_events` tables with a fixed **milestone enum** (booked → collected → at origin hub → departed → arrived destination port → customs → out for delivery → delivered, plus exceptions). Public lookup returns a limited view | Translatable statuses; no fabricated events |
| Email | **Resend** or Postmark ❓ with React Email templates in EN and FR | Transactional only at first |
| Files | S3-compatible private bucket (Cloudflare R2, S3 or Supabase Storage) ❓ with signed URLs, type and size checks | Customs documents, IDs, photos |
| Payments (later) | **Stripe** Checkout in EUR, plus XAF/mobile money ❓ | Future phase |
| Testing | **Vitest** (unit: pricing, schemas), **Playwright** (E2E plus axe accessibility), and `next build` in CI | |
| Observability | Sentry (or similar) and structured server logs | |
| Hosting | Vercel or another Node host ❓. Environment variables documented in `.env.example` | No deployment config exists today |

### Proposed folder structure (incremental, not a rewrite)

```
app/
  [locale]/
    (marketing)/   page.tsx, services/[slug], about, contact, faq, legal/*
    (auth)/        login, register, reset    ← builds on the uncommitted route group
    (portal)/      portal/**                  ← customer, protected
    (admin)/       admin/**                   ← staff, protected (replaces /dashboard demo)
    quote/, track/
  api/             track/ (public read), webhooks/
lib/
  db/ (schema, client, migrations)   auth/   pricing/   schemas/   email/   storage/
  domain/ (types, status enums, id generation)
components/
  ui/ (shadcn)   marketing/   quote/   tracking/   portal/   admin/   layout/
messages/ en.json fr.json   (split into namespaces as the files grow)
docs/
```

---

## 9. Phased implementation plan

Each phase ends with a reviewable PR (or a small set of PRs), green checks, and owner sign-off where marked.

### Phase 0: Stabilise and protect (≈1–2 days)
_Goal: the current site works and no longer misleads or leaks._
- Upgrade `next` (and `eslint-config-next`) to the latest **15.5.x**, plus `next-intl`, `zod` and other `npm audit` fixes within semver. Re-run the build.
- Fix the middleware matcher to exclude `api`.
- Fix the tracking icon mapping (string → icon map) and remove the fabricated "continues in transit" event.
- Disable `GET /api/quote` listing and `POST /api/track` (return 401/405) until auth exists.
- Mark portal and dashboard as "preview" or hide them from navigation, and add `noindex`. **Do not delete them.**
- Hide or replace fabricated testimonials, stats and the case study, pending owner content (D-4).
- Fix the brand name everywhere once the owner confirms it (D-1).
- Use `public/LOGO.png` instead of the CDN placeholder.
- Commit or settle the uncommitted `(auth)` route-group work with the owner. Fix the duplicate heading.
- Add `.env.example`, a real README, and fix the `components.json` CSS path.
- **DoD:** quote submit returns 200 locally; tracking demo numbers resolve; `npm audit --omit=dev` has no critical issues; build, lint and tsc pass; no fabricated claims are visible.

### Phase 1: Design system and layout shell (≈1 week)
_Goal: a coherent, brand-specific, accessible foundation._
- Brand tokens (primary, accent, semantic success, warning, danger, info), in light theme first. Dark theme only if wanted (D-15).
- Load fonts with `next/font`; define a type scale and spacing rhythm; remove the `.container` override.
- Locale-aware navigation (`createNavigation`), one header component, a real footer, a skip link, and an accessible mobile menu.
- Motion policy: subtle, `prefers-reduced-motion` respected, content visible without JS.
- Shared `StatusBadge`, `EmptyState`, `ErrorState`, `PageHeader`, `FormField`.
- Convert the homepage to a Server Component with client islands.
- **DoD:** Lighthouse accessibility ≥ 95 on the homepage; axe has no serious or critical issues; no horizontal overflow from 360 px to 1440 px; LCP element present in SSR HTML.

### Phase 2: Content and marketing pages (≈1 week, depends on owner content)
- Service pages (parcels and personal effects, barrels and boxes, air, sea and containers, vehicles, commercial cargo), only for services the owner confirms (D-2).
- Route pages (Ireland → Cameroon first), "How it works", FAQ, prohibited items, contact page with a working form (server action plus email once Phase 5 lands; until then use a `mailto:` or WhatsApp fallback).
- Legal pages: terms, privacy (GDPR), cookies. Cookie banner only if non-essential cookies are introduced.
- Per-locale metadata, `hreflang`, sitemap, robots, Open Graph image.
- **DoD:** every nav and footer link resolves; FR content reviewed by a fluent speaker; no `#` links.

### Phase 3: Data foundation (≈1 week)
- Choose a DB and ORM (D-9). Schema: `users`, `customers`, `addresses`, `quote_requests`, `quotes`, `rate_cards`, `rate_bands`, `surcharges`, `shipments`, `shipment_events`, `documents`, `invoices` (stub), `audit_log`.
- Migrations under version control; seed script with **clearly fake** data for local development only.
- Domain enums (service type, shipment status, milestone codes) and a non-sequential, collision-safe reference generator (e.g. `ML-IE-CM-7K3F9Q`).
- **DoD:** `migrate` and `seed` run cleanly from scratch; no destructive migration; schema reviewed.

### Phase 4: Request-a-quote workflow (≈1–2 weeks), amended 2026-10-29
- Persist requests from the Phase 1 wizard via a server action. Statuses: `SUBMITTED → UNDER_REVIEW ⇄ AWAITING_CUSTOMER → QUOTED → ACCEPTED | DECLINED | EXPIRED` (+ `CANCELLED`), all audited. See ARCHITECTURE §4.1.
- **No automatic price.** Staff enter amount, currency, inclusions, exclusions and validity (the staff screens arrive in Phase 9; until then an admin-only minimal screen is used after Phase 6).
- Zod validation on client and server; rate limiting; honeypot (D-14).
- **Deferred (needs D-5):** `lib/pricing` and rate cards, first as a staff-side price suggestion, and only later, if approved, as customer-facing estimates.
- **DoD:** E2E request → confirmation in EN and FR; the request is stored and visible to staff; validation rejects invalid input on the server; no price is displayed anywhere to customers.

### Phase 5: Notifications and file uploads (≈1 week)
- Email provider (D-10). Templates in EN and FR: quote received (customer and staff), quote ready, booking confirmed, status changes.
- Private uploads for the quote and booking flows (repair `custom-image-uploader` or replace it with a document uploader). Size and type limits, signed URLs.
- **DoD:** emails render in both locales; uploads are rejected above the limit or for disallowed types; files are not publicly listable.

### Phase 6: Authentication and roles (≈1 week)
- Auth library (D-11). Customer self-registration (verified email), staff accounts invited by an admin.
- Route-group layouts for `(portal)` and `(admin)`, with server-side session checks in layouts **and** in every server action and query.
- Settles the current uncommitted `(auth)` work.
- **DoD:** unauthenticated access to portal and admin redirects; a customer cannot read another customer's records (tested); staff-only actions reject customers (tested).

### Phase 7: Shipments, booking and tracking (≈1–2 weeks)
- Accept quote → booking → shipment creation.
- Staff record milestone events (bulk update per container or consignment for sea freight).
- Public tracking page: milestone stepper, current status in plain language, expected next step, last updated time, contact CTA. Limited public data (no names or addresses).
- Optional email or WhatsApp notifications on milestone change (D-12).
- **DoD:** tracking shows only real events; status labels translated; E2E staff update → public page reflects it.

### Phase 8: Customer portal (≈1 week)
- Replace mock data with real queries: shipments, quotes (accept or book), documents, profile and addresses. Empty, loading and error states. Translated.
- **DoD:** all buttons functional or removed; portal works at 360 px.

### Phase 9: Staff admin (≈2 weeks)
- Replace the shadcn demo dashboard. Quote inbox and pricing, shipment board, customer list, rate-card editor (with effective dates), basic financial records (amounts, paid/unpaid, manual payments), audit log.
- **DoD:** staff can run a full quote → delivery cycle without database access; every price change is audited.

### Phase 10: Payments (future, gated on D-7)
- Stripe Checkout for EUR deposits or full payment; webhook-driven invoice status; XAF / mobile money evaluated separately.
- **DoD:** test-mode end-to-end; webhooks verified and idempotent; no card data touches our servers.

### Phase 11: Hardening and launch
- Security headers and CSP; remove `X-Powered-By`; monitoring; backups; uptime checks; performance budget; final accessibility pass; analytics with consent (D-13); production deployment runbook.

---

## 10. Dependencies between phases

```
P0 Stabilise
 └─► P1 Design system ─► P2 Content pages
 └─► P3 Data foundation ─┬─► P4 Quotation engine ─┐
                         ├─► P5 Email + uploads ──┤
                         └─► P6 Auth & roles ─────┴─► P7 Shipments/tracking ─► P8 Portal
                                                                            └─► P9 Admin ─► P10 Payments
                                                                                         └─► P11 Launch
```
- P1 and P3 can run in parallel after P0.
- P4 depends on owner pricing data (D-5). Without it, P4 can ship as "request a quote" with staff-entered prices.
- P2 depends on owner content (D-2, D-3, D-4).
- P6 must land before any personal data is shown back to users (P7 public tracking shows only limited data).

---

## 11. Testing strategy

| Level | Tooling | Scope |
|---|---|---|
| Static | `tsc --noEmit`, ESLint (plus `jsx-a11y`), Prettier | Every PR |
| i18n | Script: key parity EN↔FR, no unused keys, no hard-coded UI strings (lint rule) | Every PR |
| Unit | Vitest | Pricing engine (table-driven), Zod schemas, reference ID generator, status mapping |
| Integration | Vitest + test database (Docker Postgres or Neon branch) | Server actions: authorisation, validation, persistence |
| E2E | Playwright (Chromium + WebKit mobile viewport) | Quote flow, tracking lookup, login, portal isolation, admin status update, EN and FR |
| Accessibility | `@axe-core/playwright` in E2E; manual keyboard and screen-reader pass per phase | |
| Visual | Playwright screenshots at 360 / 768 / 1280 px for key pages | From Phase 1 |
| Security | `npm audit` in CI, dependency updates (Renovate/Dependabot), authz tests, rate-limit tests | |
| Build | `next build` in CI on every PR | |

### Checks actually run during this audit (2026-10-29)
| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | ✅ exit 0 |
| `npm run lint` | ✅ 0 errors, 5 warnings |
| `npm run build` (Next 15.5.0 Turbopack) | ✅ compiled; 8 app routes + 2 API routes |
| `next start -p 3100` + `curl` | `/en`, `/fr` and all pages 200; `/api/quote` and `/api/track` → **307 to `/en/api/*` → 404** |
| Browser check (Chrome, 1536 px) | Hero invisible for ~1–2 s; horizontal overflow 50 px; tracking "not found" for the demo number; dashboard navbar overlap; login shows two headings; FR quote page shows English calculator |
| `npm audit --omit=dev` | ❌ 7 vulnerabilities (1 critical, 5 high, 1 moderate) |
| Mobile viewport | ⚠️ Not verified in the browser (window resize not applied); mobile findings in the UI audit come from code review |

---

## 12. Definition of done (applies to every phase, in addition to the phase-specific DoD)

- `tsc`, lint, unit tests, E2E for touched flows, and `next build` all pass in CI.
- All new UI strings exist in **both** `en.json` and `fr.json`; FR reviewed.
- Works with keyboard only; axe has no serious or critical issues; respects reduced motion.
- No horizontal overflow from 360 px to 1440 px.
- Loading, empty and error states exist for every data view.
- Server-side validation and authorisation on every mutation.
- No secrets in the repo; new env variables added to `.env.example`.
- No fabricated business claims; any unconfirmed content is clearly a placeholder and not deployed to production.
- Docs updated (this roadmap's status table and the README).

---

## 13. Questions requiring business-owner decisions

The full list, with options and recommendations, is in [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md). The ones that block work:
1. **D-1** Official brand name and domain: "Marcel", "Marchelo" or "Machelo" Logistics?
2. **D-2** Which services and routes are operational today?
3. **D-4** Real testimonials, stats and case studies, or remove them?
4. **D-5** Pricing model and real rate tables (per kg? per barrel? per container? per vehicle?), currency, VAT.
5. **D-6** Instant price vs "estimate, confirmed by staff".
6. **D-9 / D-11** Database and auth provider preferences or constraints (budget, hosting).
