# Phase 1 — Redesign Specification (all routes)

> **Historical planning document (2026-10-29).** Current status is in [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md); open owner questions are in [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md). Decision IDs of the form D-nn used below were renumbered there.


_Last updated: 2026-10-29 · Status: **specification for review.** Implementation starts only after Phase 0 is merged._

Related: [UI-UX-AUDIT.md](./UI-UX-AUDIT.md) · [PHASE-0-PLAN.md](./PHASE-0-PLAN.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md)

---

## 0. Scope and rules

**Phase 1 builds:**
1. The design system: tokens, type, spacing, components, motion.
2. The three application shells: public, customer and staff layouts.
3. All **public** routes redesigned, including the request-a-quote UI with submission still gated by D-21.
4. Customer and staff routes **specified in full here**, with their shells and states built behind `ENABLE_PREVIEW_AREAS`. Their data screens are implemented in Phases 6–9 against real data. **No mock data ships.**

**Content rules (apply everywhere)**
- Only owner-confirmed facts (D-1, D-2, D-3, D-8). If a fact is unconfirmed, the element is hidden, or it uses neutral wording marked `{{NEEDS_OWNER}}` in the spec and translation files, and that marker can never reach a production build (a build check fails if it does).
- Copy shown here in quotes is **structural example wording**, not approved text.
- The proposition to communicate, once confirmed: shipping from **Ireland to Cameroon** (services per D-2).

**Request-a-quote rule:** no automatic price is displayed anywhere. Every quote is reviewed and priced by staff (D-6 interim). The current `QuoteCalculator` is removed from the public quote page. Its code stays in the repository until D-5 is decided, then it is either reused for a staff-side price suggestion or deleted.

---

## 1. Design system

### 1.1 Tokens (proposal, pending D-23 brand assets)

| Token | Light value (proposal) | Use |
|---|---|---|
| `--brand-700` / `--primary` | Deep navy, e.g. `oklch(0.32 0.08 255)` | Primary buttons, links, header accents |
| `--brand-50` | `oklch(0.97 0.015 255)` | Tinted sections, selected states |
| `--accent` | Warm amber/terracotta, e.g. `oklch(0.70 0.15 55)` | One highlight per view (e.g. hero CTA). Never used for text on white |
| `--success` / `--warning` / `--danger` / `--info` | Semantic set with paired `-bg` and `-fg` | Status badges, alerts. Always icon + text, never colour alone |
| Neutrals | Existing shadcn neutral scale | Surfaces, borders, muted text |
| `--radius` | 8 px (cards), 6 px (inputs and buttons) | — |
| Elevation | Level 0: border only · 1: border + `shadow-sm` (cards on tint) · 2: `shadow-lg` (popovers, sheets) | Replaces ad-hoc `shadow-2xl` |

Contrast: all text pairs ≥ 4.5:1 (≥ 3:1 for 24 px+ or bold 19 px+). This is verified with a script in CI.

### 1.2 Typography (D-24: Inter via `next/font`)

| Style | Size / line-height (mobile → desktop) | Weight |
|---|---|---|
| Display (hero H1) | 36/40 → 56/60 | 700 |
| H1 (page) | 30/36 → 40/48 | 700 |
| H2 | 24/32 → 30/38 | 600 |
| H3 | 20/28 | 600 |
| Body | 16/26 | 400 |
| Small | 14/20 | 400 |
| Caption / label | 13/18 (labels 14/20, 500) | 500 |

- At most two weights per view, plus bold for emphasis. Never smaller than 16 px for body text on mobile.
- French strings run about 15–25% longer than English. All components are tested with the FR strings.

### 1.3 Spacing, layout and breakpoints
- 4/8 px rhythm. Section padding: 64 px mobile and 96 px desktop. One `Container` component (max 1200 px; 16 px gutters on mobile, 24 px from `md`). The custom `.container` CSS override is removed.
- Breakpoints: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280. Designs are verified at **360, 390, 768, 1024, 1280 and 1440 px**.
- Reading width for long text: 65–75 characters.

### 1.4 Motion
- Content is visible on first paint. No entrance delays on above-the-fold content.
- Interaction transitions take 150–200 ms (`ease-out`). Optional section reveals use opacity only, no positional offset (which avoids overflow).
- `MotionConfig reducedMotion="user"` is applied globally. With reduced motion, there are no transforms.
- Framer Motion is kept but used sparingly. Hover scale effects on non-interactive elements are removed.

### 1.5 Component inventory

| Component | Notes |
|---|---|
| `SiteHeader` | Logo · Track · Get a quote · Services · Help · EN/FR · (Sign in once Phase 6 ships). Mobile: the logo, a Track icon button with a label, and a Menu button opening a Sheet. Skip link to `#main` |
| `SiteFooter` | Services, Help, Company, Legal, contact per country, business details (D-8). No `#` links |
| `LocaleSwitcher` | Text "EN / FR" (no flags). Keeps the current path and query |
| `Container`, `Section`, `PageHeader` | Page header = breadcrumb (non-home pages), H1, intro text, optional actions |
| `Button`, `LinkButton` | Verb-first labels. Minimum height 44 px for primary actions on touch devices |
| `FormField` | Label, optional hint, control, error (`aria-describedby`, `aria-invalid`). Validates on blur, clears the error on fix |
| `ChoiceCards` | Accessible radio group (`role="radiogroup"`, arrow-key navigation) for service selection |
| `Stepper` | Labelled steps, current step announced; on mobile, "Step 2 of 5" plus a progress bar |
| `ErrorSummary` | At the top of forms after a failed submit; links to the fields |
| `Alert` | info / success / warning / danger. Uses `role="status"` or `role="alert"` as appropriate |
| `ContactActions` | WhatsApp, call and email per country, from one config file (single source for D-1/D-2 contact data) |
| `StatusBadge` | Maps an enum code to an icon, a translated label and a semantic colour |
| `MilestoneTracker` | Horizontal on desktop, vertical on mobile. States: done, current, upcoming, exception |
| `EmptyState`, `ErrorState`, `Skeleton` | Standard trio for every data view |
| `DataTable` (staff) | Sortable, keyboard accessible; becomes stacked cards below `md` |
| `DescriptionList` | Key-value details (shipment and request details) |

### 1.6 Internationalisation rules
- All navigation through `createNavigation` (`Link`, `redirect`, `useRouter`) from next-intl.
- Messages are split into namespaces (`common`, `nav`, `home`, `services`, `quote`, `track`, `portal`, `admin`, `auth`, `legal`, `errors`, `status`).
- Dates, numbers and currency use `useFormatter` / `Intl` with the page locale and an explicit time zone (`Europe/Dublin` or `Africa/Douala`, shown to the user).
- Per-locale metadata (title, description, `alternates.languages` hreflang). Status and milestone codes are translated, never stored text.
- CI checks: EN/FR key parity; no unused keys; no `{{NEEDS_OWNER}}` markers in production builds.

### 1.7 Accessibility acceptance (every route)
WCAG 2.2 AA. Specifically:
- One H1 per page; logical heading order.
- Visible focus rings; full keyboard operation; focus trapped and restored in sheets and dialogs.
- Touch targets ≥ 44 × 44 px.
- axe (Playwright) shows no serious or critical issues.
- Pages are usable at 200% zoom and at 320 px width without horizontal scrolling.

---

## 2. Application shells

| Shell | Routes | Header | Footer | Notes |
|---|---|---|---|---|
| **Public** `(marketing)` | home, services, how it works, destinations, quote, track, help, legal, contact | `SiteHeader` | `SiteFooter` | Floating WhatsApp button **hidden on form steps**; replaced by `ContactActions` inline there |
| **Auth** `(auth)` | login, register, forgot/reset | Minimal (logo + EN/FR) | Minimal legal links | Replaces the current global CSS that hides the navbar. Builds on the uncommitted route group (D-19) |
| **Customer** `(portal)` | `/portal/**` | App header (logo, EN/FR, account menu) + side nav (desktop) / bottom tab bar (mobile) | none | `noindex`; session required (Phase 6) |
| **Staff** `(admin)` | `/admin/**` | App header + collapsible sidebar (reuses `ui/sidebar`) | none | `noindex`; role required (Phase 6). Replaces the `/dashboard` demo |

The root `app/[locale]/layout.tsx` keeps only `<html>`, fonts, `NextIntlClientProvider` and `MotionConfig`. Each shell lives in its route-group layout.

---

## 3. Route-by-route specification

Legend for each route: **Purpose · Audience · Pattern · Content and sections · States · Responsive · Data / phase · Depends on.**

### 3.1 Existing routes

#### `/[locale]` Home
- **Purpose:** explain in five seconds what is shipped, from where to where, and lead people to *Get a quote* or *Track*.
- **Audience:** individuals and families sending goods to Cameroon; small businesses.
- **Pattern:** marketing landing.
- **Sections, in order:**
  1. **Hero.** H1 states the confirmed proposition, e.g. "Shipping from Ireland to Cameroon" (`{{NEEDS_OWNER}}` D-1/D-2), plus a one-sentence subtitle. A **tabbed panel: _Get a quote_** (service choice cards linking to `/quote?service=…`) **| _Track_** (reference input → `/track/[ref]`). Secondary action: WhatsApp.
  2. **What we ship.** Cards for confirmed services only (D-2), each linking to its service page. Unconfirmed services are not shown.
  3. **How it works.** Four steps: request a quote → we confirm the price → drop off or collection → shipping and delivery or collection in Cameroon. Wording is generic until D-3.
  4. **Where we ship.** Ireland → Cameroon (cities per D-2). Transit time ranges only if D-3 is confirmed.
  5. **Why customers choose us.** Only verifiable facts (e.g. "Offices in Ireland and Cameroon", if confirmed). Reviews only if real and consented (D-4).
  6. **FAQ preview.** Three to five questions linking to `/help`.
  7. **Contact strip.** `ContactActions` per country plus opening hours (D-1).
- **States:** fully static; no loading states.
- **Responsive:** hero panel full width under `md`; service cards 1 / 2 / 3 columns.
- **Data / phase:** static Server Component; Phase 1.
- **Depends on:** D-1, D-2, D-3, D-4, D-23 (photos).

#### `/[locale]/quote` Request a quote (replaces the calculator page)
- **Purpose:** collect a complete, structured request that staff can price without back-and-forth.
- **Pattern:** multi-step form (wizard) with a review step. **No price shown.**
- **Steps:**
  1. **Service.** `ChoiceCards` of confirmed services (D-2). Preselected from `?service=`.
  2. **Route.** Origin country (fixed to Ireland if D-2 says so; otherwise a select), origin town (free text, for collection), destination country (from the confirmed route list), destination city (select or free text, D-2), and collection vs drop-off if offered.
  3. **Your items.** Fields depend on the service, defined by owner answer Q16. Until then, a **generic set**: a repeatable item list (description, quantity, approximate weight in kg, approximate dimensions in cm as three numeric fields), an optional total declared value with currency, and free-text notes. Vehicle variant: make, model, year, running or not. Container variant: 20ft / 40ft, contents type.
  4. **Your details.** Full name, email, phone with country code, preferred contact method (email / phone / WhatsApp), preferred language (defaults to the page locale).
  5. **Review and send.** Summary with "Edit" links per step; privacy notice and a consent checkbox (wording per D-8); submit button "Send quote request".
- **Uploads:** optional photos or documents on step 3 only if D-25 approves, after Phase 5.
- **Validation:** Zod schemas shared by client and server; errors shown on blur; an `ErrorSummary` on submit; the draft is saved to `sessionStorage` (cleared after success).
- **States:**
  - Submitting: the button shows a spinner with "Sending…" and `aria-busy`.
  - **Unavailable (D-21, until Phase 3/5):** shown *before* step 1 as an info alert explaining that online requests are not yet active, with `ContactActions`. The wizard can still be explored but the final button is replaced by "Send by WhatsApp" / "Send by email", which prefill a summary in the message body. No data is stored by us.
  - Failure: a danger alert, the data is kept, with Retry and contact actions.
- **Success → `/[locale]/quote/confirmation`** (new, below).
- **Responsive:** single column under `lg`; on `lg`+ a right-side "Your request" summary panel (no price). Sticky step header on mobile.
- **Data / phase:** UI in Phase 1; persistence Phase 3; emails Phase 5.
- **Depends on:** D-2, D-6 (interim approved), D-8, D-21, D-25, Q16.

#### `/[locale]/track` Track a shipment
- **Purpose:** a fast lookup by reference.
- **Pattern:** single-input search.
- **Content:** H1 "Track your shipment"; a reference input with a format hint (once the reference format is defined in Phase 3); a Track button; a help link "Where do I find my reference?".
- **Behaviour:** on submit, navigate to `/[locale]/track/[reference]` (shareable deep link).
- **States:** inline validation for an empty or malformed reference.
- **Data / phase:** Phase 1 (UI); real data Phase 7.

#### `/[locale]/portal` Customer portal (currently a mock)
- Replaced by the `(portal)` shell and routes in §3.3. In Phase 1, the only output is the shell plus an honest "Customer accounts are coming soon" state behind `ENABLE_PREVIEW_AREAS`. **The mock arrays are deleted only when the real screens land (Phase 8), per D-18.**

#### `/[locale]/dashboard` Staff dashboard (currently the shadcn demo)
- Superseded by `/[locale]/admin` (§3.4). `/dashboard` permanently redirects to `/admin` once the admin shell exists; the demo files are removed in Phase 9 (D-18).

#### `/[locale]/login`, `/[locale]/register` (uncommitted `(auth)` group)
- **Purpose:** customer and staff sign-in; customer registration.
- **Pattern:** a centred single-column form (max 400 px). On `lg`+, an optional brand panel with the logo and a real photo (D-23). **No testimonial.**
- **Login fields:** email, password (show/hide toggle), "Forgot password?", "Sign in"; an optional "Email me a sign-in link" (if magic link is chosen, D-11).
- **Register fields:** full name, email, password with visible requirements, preferred language, terms/privacy consent (D-8), "Create account". Then the verify-email screen.
- **Errors:** "Email or password is incorrect" (never reveals whether an account exists). Rate-limit message with a retry time.
- **New:** `/[locale]/forgot-password` and `/[locale]/reset-password`.
- **States:** submitting, error, locked out, email sent.
- **Data / phase:** UI in Phase 1 (hidden from nav, `noindex`); working in Phase 6.
- **Depends on:** D-11, D-10, D-8, D-19.

#### `/api/quote`, `/api/track`
- No UI. After Phase 0 they are gated. In later phases, quote submission moves to a **server action**; `/api/track` stays as a minimal public read endpoint (Phase 7).

### 3.2 Proposed public routes

| Route | Purpose and content | States | Phase | Depends on |
|---|---|---|---|---|
| `/[locale]/quote/confirmation` | H1 "Request received"; **reference number** (copy button); summary of what was sent; **"What happens next"** (staff review, then a quote by the chosen contact method; **no time promise unless D-3**); what to prepare (e.g. items list); contact actions; "Track a request" once the portal exists | Reference missing → redirect to `/quote` | 1 (UI), 3 (live) | D-3, D-21 |
| `/[locale]/track/[reference]` | Header: reference, plain-language status sentence, ETA range (if known); `MilestoneTracker`; event log (newest first, local time + time zone); "What happens next"; help and contact. Public view shows **no** names, addresses, prices or documents | Loading skeleton; not found (with help); exception state (held or delayed) explained in plain language | 1 (UI), 7 (data) | D-12, milestone list (Q24) |
| `/[locale]/services` | Overview cards of the confirmed services | — | 1 | D-2 |
| `/[locale]/services/[slug]` | Per service: who it is for; what you can send; how to prepare (e.g. packing barrels); what's not allowed (links to prohibited items); how pricing works (staff quote); "Request a quote for this service" button (prefills) | Unknown slug → 404 | 1–2 | D-2, D-8, owner content |
| `/[locale]/destinations/cameroon` | Route page: cities served, collection points, customs information (owner-provided), typical timelines (if D-3 is confirmed) | — | 2 | D-2, D-3 |
| `/[locale]/how-it-works` | A five-step explanation from request to delivery, with pre-departure, customs and collection guidance | — | 2 | D-3 |
| `/[locale]/help` | FAQ grouped by topic (quotes, packing, customs, tracking, payment), searchable on the client; contact at the end | Empty search → "No results" + contact | 2 | Owner answers |
| `/[locale]/help/prohibited-items` | Owner-provided list | — | 2 | Q10, D-8 |
| `/[locale]/about` | Real company story, team (optional), registered details | — | 2 | D-1, owner content |
| `/[locale]/contact` | `ContactActions` per country, hours, addresses (D-1), and a contact form (server action, Phase 5; until then the D-21 state) | Sending / sent / failed | 1 (UI), 5 (live) | D-1, D-21, D-10 |
| `/[locale]/legal/terms`, `/legal/privacy`, `/legal/cookies` | Owner- or solicitor-supplied text, rendered from MDX per locale; last-updated date | — | 2 | D-8 |
| `not-found`, `error` (per locale) | Friendly message, search or Track input, link to home, contact actions | — | 1 | — |
| `sitemap.xml`, `robots.txt` | Locale alternates; portal, admin and auth excluded | — | 2 | D-16 domain |

### 3.3 Customer interfaces (`(portal)`, built in Phases 6–8)

All routes need a session and are `noindex`. Every list has loading, empty and error states, and every action is real or absent.

| Route | Purpose | Key content | Empty state | Phase |
|---|---|---|---|---|
| `/portal` | Overview | Greeting; "Needs your attention" (quotes awaiting reply, missing info); active shipments with a mini `MilestoneTracker`; recent requests | "No requests yet" + "Request a quote" | 8 |
| `/portal/requests` | Quote requests list | Reference, service, route, status badge (Submitted / Under review / Awaiting your reply / Quoted / Accepted / Declined / Expired), date | Same as above | 8 |
| `/portal/requests/[ref]` | Request detail | Submitted details; staff questions and replies thread; **quote card** (amount, currency, inclusions, exclusions, valid until) with Accept / Decline (confirmation dialog, named action); history | — | 8 |
| `/portal/shipments` | Shipments list | Reference, service, status, ETA range; filter by status | "No shipments yet" | 8 |
| `/portal/shipments/[ref]` | Shipment detail | Full milestone tracker and log; documents (if D-25); contact | — | 8 |
| `/portal/documents` | Documents | List by shipment; upload requested documents (D-25) | "No documents" | 8 (after Phase 5) |
| `/portal/account` | Profile | Name, phone, preferred language and contact method, saved addresses, password, delete-account request (GDPR) | — | 8 |

**Mobile:** a bottom tab bar (Overview, Requests, Shipments, Account); cards instead of tables; primary action reachable with the thumb.

### 3.4 Staff interfaces (`(admin)`, built in Phases 6–9)

Roles: `staff` (operations) and `admin` (plus users and settings). Every mutation is audited.

| Route | Purpose | Key content and actions | Phase |
|---|---|---|---|
| `/admin` | Work queue | Counts: new requests, awaiting customer, quotes expiring soon, shipments with exceptions; shortcuts | 9 |
| `/admin/requests` | Quote request inbox | `DataTable`: reference, customer, service, route, status, age, assignee; filters (status, service, date); search by reference, name or email | 9 (needs 3, 6) |
| `/admin/requests/[ref]` | Review and price | Request details and attachments; **internal notes**; "Ask customer for information" (message, sets AWAITING_CUSTOMER); **"Create quote"** form (amount, currency, inclusions/exclusions checklist, valid-until, message to customer) → preview → "Send quote" (sets QUOTED, emails the customer); cancel with reason; status history | 9 |
| `/admin/shipments` | Shipment board | Table or board grouped by milestone; filter by service, departure, status | 9 (needs 7) |
| `/admin/shipments/[ref]` | Update tracking | Add a milestone event (milestone code, location, time with time zone, public note EN/FR, internal note); **bulk update** for all shipments in a consolidation or container; mark exception | 9 |
| `/admin/customers`, `/admin/customers/[id]` | Customer records | Contact details, requests, shipments, notes; GDPR export and delete request handling | 9 |
| `/admin/users` (admin only) | Staff accounts | Invite, change role, deactivate | 9 |
| `/admin/settings` (admin only) | Business configuration | Contact details, services shown, routes and cities, milestone labels, quote validity default. **Rate cards only after D-5** | 9 |
| `/admin/audit` (admin only) | Audit log | Who changed what, when; filter by entity | 9 |

**Staff UX notes:** dense tables are acceptable on desktop; keyboard shortcuts are optional; every destructive or customer-facing action (send quote, cancel, bulk update) gets a confirmation that names the action and the number of affected records; flows must remain usable at 768 px (tablet in the depot).

---

## 4. Request-a-quote end-to-end (customer ⇄ staff)

| Step | Customer sees | Staff sees | Status |
|---|---|---|---|
| 1 | Wizard → review → "Send quote request" | — | — |
| 2 | Confirmation page with reference; email copy (Phase 5) | New item in the inbox; email notification (Phase 5) | SUBMITTED |
| 3 | (optional) Email or portal message asking for details | "Ask customer" | AWAITING_CUSTOMER |
| 4 | — | Opens and reviews | UNDER_REVIEW |
| 5 | Email + portal: quote with amount, inclusions, exclusions, valid until | "Send quote" | QUOTED |
| 6 | Accept or Decline (portal, or a link in the email) | Notified | ACCEPTED / DECLINED |
| 7 | — | Automatic after valid-until | EXPIRED |
| 8 | Booking instructions (Phase 7) | Create shipment | → shipment |

Wording never implies a price or timeline the owner hasn't confirmed. Status labels are translated from codes.

---

## 5. Phase 1 deliverables and acceptance

| # | Deliverable | Acceptance |
|---|---|---|
| 1 | Tokens, font, type scale, spacing in `globals.css` + `next/font` | Contrast script passes; no raw `gray-*` / `green-*` classes outside tokens (lint rule or grep check) |
| 2 | Component library (§1.5) with an internal preview page `/[locale]/design-preview` (returns `notFound()` unless `NODE_ENV !== "production"`; a `_`-prefixed folder can't be used because App Router treats it as private and non-routable) | Each component shown in EN and FR, all states, keyboard tested |
| 3 | Public, auth, customer and staff shells | Correct header/footer per area; no navbar overlap; skip link works |
| 4 | Home, quote wizard (+ confirmation), track (+ `[reference]` UI), services, contact, 404/error | Content rules respected; `{{NEEDS_OWNER}}` absent from production build; Lighthouse accessibility ≥ 95 and performance ≥ 90 on home (mobile) |
| 5 | Auth pages UI (non-functional, hidden, `noindex`) | Labels present; error copy as specified |
| 6 | Locale-aware navigation everywhere; namespaced messages; `Intl` formatting | EN/FR parity check passes; switching locale keeps the path |
| 7 | Playwright smoke tests (home, quote wizard to review step, track input, 404) at 390 and 1280 px + axe | No serious or critical axe issues; no horizontal overflow at 360–1440 px |
| 8 | Owner review on a private preview URL (needs D-16) | Owner sign-off recorded |

**Not in Phase 1:** persistence, emails, auth logic, portal and admin data screens, pricing, payments.

## 6. Dependencies for Phase 1

| Can start without owner answers | Needs owner answers before sign-off |
|---|---|
| Tokens (with the proposed palette), type, components, shells, wizard mechanics, track UI, 404, i18n infrastructure, tests | Final palette and logo (D-23); name (D-1); service list and wizard fields (D-2, Q16); time wording (D-3); legal and consent text (D-8); reviews (D-4); preview hosting (D-16) |
