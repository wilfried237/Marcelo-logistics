# Phase 0 — Stabilise and Protect: Task List

_Last updated: 2026-10-29 · Status: **planned, not started.** Awaiting the approvals listed in §1._

**Goal:** the existing site stops leaking data, stops misleading visitors, and is safe to deploy to a private preview, without adding new features or inventing content.

**Out of scope:** new pages, redesign, database, auth, email, pricing, deployment to production, any change to the live WordPress site or DNS.

Related: [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Prerequisites (must be confirmed before any code change)

| Ref | Needed | From | Blocks |
|---|---|---|---|
| D-19 | Keep, commit separately, or discard the uncommitted `(auth)` work and the moved login page | Owner | All commits |
| D-22 | Permission to create branch `phase-0-stabilisation`, commit, and open a PR | Owner | All tasks |
| R-12 | TLS certificate checking re-enabled in the environment that runs `npm install` | Machine owner | P0-03 |
| D-4 | Approval to hide fabricated or unverified content | Owner | P0-09 |
| D-21 | Approval of the "online submission temporarily unavailable, contact us via…" interim state | Owner | P0-06, P0-07 |

Tasks P0-01 to P0-05 and P0-12 to P0-14 are purely technical and could start as soon as D-19 and D-22 are answered.

## 2. Findings confirmed during investigation (2026-10-29)

1. **API routing bug: root cause confirmed.** The matcher in `middleware.ts` (`/((?!_next|.*\\..*).*)`) matches `/api/quote` and `/api/track`. next-intl then redirects them (307) to `/en/api/...`, which returns 404. Introduced in `c42a872`. Testing the regex against sample paths shows that excluding `api` fixes it without affecting locale pages.
2. **Dependency advisories.** `npm audit --omit=dev` reports 7 vulnerable packages. `next@15.5.0` alone has **4 critical** advisories (remote code execution) and many high ones. **All are fixed in `next@15.5.28`**, the latest 15.5 patch, which also carries the postcss and sharp fixes. Also: `next-intl` (open redirect, fixed in 4.9.1+; latest 4.x is 4.14.9), `zod` (memory exhaustion, fixed in 4.6.6+; latest 4.6.7), and `nanoid` / `source-map-js` (transitive; `npm audit fix` without `--force`). React is 19.1.0; latest 19.1.x is 19.1.10.
3. **Data exposure ordering risk.** Fixing the matcher **re-exposes** `GET /api/quote` (all customers' PII) and `POST /api/track` (anyone can edit tracking). The endpoints must be locked down **before or in the same commit** as the matcher fix.
4. **Fabricated content inventory** (EN keys; FR mirrors them): `stats.*`; `testimonials.*` (6 invented people, "Verified Customer", "Loved by teams worldwide"); `work.caseStudy.*` (invented case study and "Sarah Johnson" quote); `services.items.expressShipping.description` ("guaranteed delivery times", "real-time tracking"); `quote.hero.subtitle` and `quote.success.message` ("within 24 hours"); `track.hero.subtitle` and `track.shipment.timeline.description` ("real-time"); `about.paragraph1` ("years of experience"); `hero.*`/`about.*` ("global logistics experts"); `login.*` ("Your Company", Sofia Davis quote); `footer.tagline` and `footer.copyright` ("Shadcnblocks.com"); `navigation.subMenu.*.description` (web-agency copy); `components/quote-calculator.tsx` ("Vehicle transportation with insurance"); `app/api/track/route.ts` (two fake shipments, invented events).
5. **Public customer and staff pages.** `/[locale]/portal` (fake customer data) and `/[locale]/dashboard` (shadcn demo) return 200 to anyone.
6. **Uncommitted work.** `(auth)/login/page.tsx` is the old `login/page.tsx` moved unchanged (only line endings differ, LF → CRLF). `(auth)/register/page.tsx` is identical to it. `(auth)/layout.tsx` is new. `middleware.ts` has a whitespace-only change.
7. **Live site.** `marchelo-logistics.com` serves a WordPress site on Hostinger. Phase 0 makes no changes there.

---

## 3. Tasks

Order matters: **P0-05 must land before P0-06.**

| ID | Task | Files (expected) | Needs | Acceptance criteria |
|---|---|---|---|---|
| **P0-01** | Settle the uncommitted work as decided in D-19 (e.g. a separate `chore: move auth pages into (auth) route group` commit) | `app/[locale]/(auth)/*`, `app/[locale]/login/page.tsx`, `middleware.ts` | D-19, D-22 | `git status` clean before Phase 0 work starts; no content of that work altered by Phase 0 commits |
| **P0-02** | Create branch `phase-0-stabilisation` from `master` | — | D-22 | Branch exists locally; nothing pushed until the owner agrees |
| **P0-03** | Patch dependencies: `next` + `eslint-config-next` → 15.5.28; `react`/`react-dom` → 19.1.10; `next-intl` → latest 4.x; `zod` → latest 4.x; then `npm audit fix` (**no** `--force`) | `package.json`, `package-lock.json` | R-12 | `npm audit --omit=dev` shows **0 critical, 0 high**; `tsc`, lint and build pass; `/` → `/en` redirect, `/en` and `/fr` pages 200, language switch preserves the path |
| **P0-04** | Record a baseline: run the audit probes (route statuses, API responses, SSR H1, overflow) and save the output to `docs/verification/phase-0-baseline.md` | docs | — | Baseline file committed; the same probes are re-run in P0-14 for comparison |
| **P0-05** | **Lock down the APIs** (keep the code; gate it): `GET /api/quote` returns 404 (listing removed); `POST /api/track` returns 405; `GET /api/track` no longer fabricates events; demo shipments are served only when `NODE_ENV !== "production"` **and** `ENABLE_DEMO_DATA=true`; `POST /api/quote` returns 503 `{ code: "SUBMISSION_UNAVAILABLE" }` unless `ENABLE_QUOTE_SUBMISSION=true` (D-21) | `app/api/quote/route.ts`, `app/api/track/route.ts`, `.env.example` | D-21 | curl: GET quote → 404; POST track → 405; repeated GET track returns identical events; production build without flags returns 503 / 404 as specified; no customer data in any response |
| **P0-06** | **Fix the middleware matcher** so `/api`, `/_next`, `/_vercel` and files are excluded, using the strict form `/((?!api(?:/|$)|_next|_vercel|.*\\..*).*)`. Commit the whitespace change from D-19 first | `middleware.ts` | P0-05 merged | `/api/track?trackingNumber=X` returns JSON (not 307); `/en/quote`, `/fr/track` still 200; `/quote` still redirects to the locale; a page path starting with `api-` still gets locale handling |
| **P0-07** | **Honest quote and contact states.** Quote page: when the API returns 503 or fails, show an inline alert (EN/FR) "Online requests are temporarily unavailable" with WhatsApp, phone and email actions, **keeping the entered data on screen**; fix "Back to home" to keep the locale. Contact section: replace the non-functional form with the same contact actions (form code kept but not rendered) | `app/[locale]/quote/page.tsx`, `components/contact2.tsx`, `messages/*.json` | D-21 | No form anywhere shows success without a confirmed server response; error announced to screen readers (`role="alert"`); EN and FR strings present; contact links work (`tel:`, `mailto:`, WhatsApp) |
| **P0-08** | **Tracking page fixes:** map icon names to Lucide components; translate status labels from codes; when demo data is off, a not-found result shows "We couldn't find this reference. Contact us with your reference number." plus contact actions; remove or disable the dead "Download invoice", "View documents" and "Track another" buttons (the last one resets the form) | `app/[locale]/track/page.tsx`, `messages/*.json` | — | Icons visible with demo data on; no dead buttons; error has `role="alert"`; FR shows French status text |
| **P0-09** | **Remove fabricated content** (inventory in §2.4): don't render the Stats, Testimonials and Our Work sections (components and keys kept for later real content); replace claim wording with neutral EN/FR copy written only from known facts (proposed text included in the PR for owner approval); remove "insurance" from the calculator copy | `app/[locale]/page.tsx`, `messages/*.json`, `components/quote-calculator.tsx` | D-4 | A text search of rendered EN and FR pages finds none of: "Verified Customer", "99%", "1000+", "50+", "guaranteed", "24 hours", "real-time", "insurance", "Shadcnblocks", "Your Company", "Sofia Davis", "Sarah Johnson"; owner approves the replacement text |
| **P0-10** | **Template leftovers and brand consistency:** centralise the brand name into one translation key `brand.name` used by the layout metadata, navbar, footer, contact and tracking; remove "Machelo"; the **value** is the owner's D-1 answer (until then, the PR shows the current most-used value and is flagged for owner confirmation). Use `public/LOGO.png` instead of the external CDN logo (subject to D-23). Replace the footer template copy and `#` links with links to existing sections or routes only. Remove the agency descriptions from the nav sub-menu | `components/navbar1.tsx`, `components/footer.tsx`, `app/[locale]/layout.tsx`, `messages/*.json` | D-1, D-23 | One spelling of the name across EN and FR; no external logo request (network tab); no `href="#"` in the header or footer; name value confirmed by the owner before merge |
| **P0-11** | **Gate the customer and staff previews:** `/[locale]/portal` and `/[locale]/dashboard` return `notFound()` unless `ENABLE_PREVIEW_AREAS=true`; when enabled, show a "Preview – not connected to real data" banner and `noindex`. Remove the Portal link from the public navigation. Login and register: hidden from the nav and `noindex` until Phase 6 (pages kept) | `app/[locale]/portal/page.tsx`, `app/[locale]/dashboard/page.tsx`, `(auth)/*`, `components/navbar1.tsx` | D-19 | Production build without flags: portal and dashboard → 404; with the flag: banner visible; page source contains `noindex`; no nav links to them |
| **P0-12** | **Wire dead CTAs** to existing destinations only: hero "Get started" → `/[locale]/quote`; "View services" → `#services`; "Learn more" → `#contact` (or removed). Use locale-aware links (`createNavigation` from next-intl) for header, footer and CTAs | `app/[locale]/page.tsx`, `i18n/navigation.ts` (new), nav components | — | Every button on the homepage navigates; on `/fr`, every internal link stays under `/fr/` without relying on the cookie |
| **P0-13** | **Visibility and overflow quick fixes** (no redesign): `AnimatedText` renders its words on the server (no `useEffect` split; `<span>` instead of `<div>` inside `<h1>`); remove the horizontal slide that causes overflow; respect `prefers-reduced-motion` via `MotionConfig reducedMotion="user"` in the layout; one `<h1>` per page (contact heading → `<h2>`); `aria-label` on the WhatsApp and mobile-menu buttons | `components/animated-*.tsx`, `app/[locale]/layout.tsx`, `components/contact2.tsx`, `components/float_Whatsapp.tsx`, `components/navbar1.tsx` | — | `curl /en` HTML contains the hero H1 text; `document.documentElement.scrollWidth === clientWidth` at 1536, 768 and 390 px; with reduced motion on, content appears without animation; axe shows no "button-name" or "link-name" violations |
| **P0-14** | **Baseline hardening and housekeeping:** `poweredByHeader: false`; headers `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (CSP deferred to Phase 1 to avoid breaking Framer Motion inline styles); `.env.example` listing the flags (names only); fix the `components.json` CSS path; replace the boilerplate README with setup, scripts and flag docs | `next.config.ts`, `.env.example`, `components.json`, `README.md` | — | `curl -I` shows the headers and no `X-Powered-By`; README lets a new developer run the project |
| **P0-15** | **Verification and report:** re-run the P0-04 probes, `tsc`, lint, build and `npm audit`; manual EN/FR check in the browser at 1536 px and a 390 px emulated viewport; write `docs/verification/phase-0-result.md` comparing it with the baseline | docs | All above | Every acceptance criterion above checked and recorded with actual output; any failure listed, not hidden |

### Feature flags introduced (all default **off**)

| Flag | Effect when `true` | Allowed in production? |
|---|---|---|
| `ENABLE_QUOTE_SUBMISSION` | `POST /api/quote` accepts requests (still in-memory: **dev only**) | No, until Phase 3/5 |
| `ENABLE_DEMO_DATA` | Tracking demo shipments served (also requires non-production `NODE_ENV`) | No |
| `ENABLE_PREVIEW_AREAS` | Portal and dashboard previews reachable | No |

---

## 4. Phase 0 definition of done

- [ ] All prerequisites in §1 recorded in DECISIONS-REQUIRED.md.
- [ ] P0-01 to P0-15 complete with acceptance criteria evidenced in `docs/verification/phase-0-result.md`.
- [ ] `npm audit --omit=dev`: 0 critical, 0 high.
- [ ] `tsc --noEmit`, `npm run lint` (0 errors), `npm run build` pass.
- [ ] No endpoint returns customer personal data; no unauthenticated write endpoint.
- [ ] No fabricated or unconfirmed claims rendered in EN or FR.
- [ ] No form shows success without a confirmed server response.
- [ ] PR reviewed and merged by the owner. **No deployment** beyond an optional private preview URL (requires D-16).

## 5. Rollback

Each task is a separate commit on the branch, so any task can be reverted individually. Flags let gated features be re-enabled locally without code changes. No database, DNS or production changes are made in Phase 0.
