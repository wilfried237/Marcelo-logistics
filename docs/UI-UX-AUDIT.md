# Marcel Logistics — UI/UX Audit

> **Historical planning document (2026-10-29).** Current status is in [IMPLEMENTATION-STATUS.md](./IMPLEMENTATION-STATUS.md); open owner questions are in [DECISIONS-REQUIRED.md](./DECISIONS-REQUIRED.md). Decision IDs of the form D-nn used below were renumbered there.


_Audit date: 2026-10-29 · Build audited: local production build of `master` @ `dff3ca7` plus uncommitted `(auth)` pages_

**Method**
- Code review of every page and component.
- A local production build (`next build` + `next start`) inspected in Chrome at a 1536 px viewport, in EN and FR.
- DOM checks for overflow, headings and unnamed controls.

**Limitations**
- The browser window could not be resized to a phone viewport during this session, so **mobile findings come from code review** and must be re-checked on a real device or emulator in Phase 1.
- Competitor patterns below are drawn from general familiarity with those products, **not a fresh live review**. Re-check them before final design.

Severity: **P0** blocks the task or misleads the customer · **P1** major friction or trust issue · **P2** polish or consistency

---

## 1. Cross-cutting findings

### 1.1 Brand and trust
| Sev | Finding | Where |
|---|---|---|
| P0 | Brand name spelt three ways: "Marcel" (project), "Marchelo" (title, copy, contact) and "Machelo" (navbar logo text, EN and FR) | `layout.tsx`, `messages/*.json`, `navigation.logo` |
| P0 | Fabricated social proof: six SaaS testimonials ("Product Manager at TechCorp", "40% increase in productivity") labelled **"Verified Customer"**; heading "Loved by teams worldwide... our platform" | `testimonials.tsx`, `messages.testimonials` |
| P0 | Unverified stats: "50+ countries", "1000+ shipments", "99% satisfaction", "5+ years" | `messages.stats` |
| P1 | Template leftovers: footer "Components made easy." and "© 2024 Shadcnblocks.com"; login "Your Company" with a Sofia Davis quote about "this library"; dashboard "Acme Inc / Evil Corp / shadcn"; navbar sub-menu descriptions from a web agency ("Clean, brand-aligned, responsive design") | `footer`, `(auth)/*`, `app-sidebar`, `navigation.subMenu` |
| P1 | Navbar logo is a third-party placeholder icon, although `public/LOGO.png` exists. Footer logo is a pulsing grey skeleton | `navbar1.tsx`, `footer.tsx` |
| P1 | Content is generic "global logistics" (US, China, Australia examples). Nothing communicates the real proposition: **Ireland ⇄ Cameroon**, barrels, personal effects, vehicles, diaspora customers | Homepage, tracking demo data |
| P1 | Contact email is a Gmail address next to a branded domain, which weakens credibility | `contact2.tsx` |
| P2 | Images have alt text "Demo" | `messages.common.imageAlt` |

### 1.2 Visual system
| Sev | Finding |
|---|---|
| P1 | No brand colour: the primary colour is shadcn's default near-black, so the site looks unbranded |
| P1 | The font is never loaded (`--font-geist-sans` is undefined), so the browser default is used and rendering differs by OS |
| P1 | No type scale. Hero `text-7xl` with tight tracking makes words collide visually ("Yourtrustedpartnerfor" at 1536 px), because each word is an `inline-block` with only `mr-2` |
| P2 | Raw Tailwind greys and greens bypass tokens (`text-gray-600`, `bg-green-100`...). Status colours are duplicated, and their light-mode-only classes would break in dark mode |
| P2 | Inconsistent section rhythm (`py-16`, `py-20`, `py-32`) and nested `.container` elements; the contact section has `py-32` inside a `py-20` wrapper |
| P2 | Cards mix `border-0 shadow-lg`, `border-2 dashed`, `shadow-2xl` and `hover:shadow-md` with no elevation logic |

### 1.3 Navigation and information architecture
| Sev | Finding |
|---|---|
| P0 | Primary CTAs do nothing: hero "Get Started" and "View Services", and about "Learn More", are `<Button>`s with no link or handler |
| P1 | Login and Sign up link to `#` |
| P1 | "Get Quote" and "Track" (the two primary tasks of a logistics site) are hidden inside a "Services" dropdown. Royal Mail-style clarity puts **Track** and **Quote / Send** as top-level actions |
| P1 | Links are plain `<a href="/quote">` without the locale, so each click does a full reload and relies on the cookie to keep FR |
| P1 | No dedicated service, about, contact, FAQ or legal pages. Every footer link is `#` |
| P2 | Public navbar renders on top of the staff dashboard sidebar (overlap seen in the browser); global header and footer aren't separated per area |
| P2 | Footer appears only on the homepage |
| P2 | English is shown with a 🇺🇸 flag for an Irish business. Flags for languages are discouraged anyway; use "EN / FR" text |

### 1.4 Motion and performance
| Sev | Finding |
|---|---|
| P0 | The hero is **blank for ~1–2 s** (delays of 0.8 s to 2 s), and the H1 is **empty in server HTML** because `AnimatedText` fills its words in `useEffect`. That hurts SEO, LCP and no-JS users |
| P1 | Homepage has **horizontal overflow** (page `scrollWidth` 1571 vs 1521 viewport) from the `direction="left"` slide-in |
| P1 | No `prefers-reduced-motion` handling anywhere; nearly every element animates, scales on hover or staggers |
| P2 | `whileHover` scale on non-interactive stats and cards with `cursor-pointer` implies they are clickable |
| P2 | Homepage is entirely client-rendered (`"use client"`), which ships unnecessary JS |

### 1.5 Accessibility
| Sev | Finding |
|---|---|
| P1 | Two `<h1>` on the homepage (hero + "Contact Us"); `<div>` nested in `<h1>`; heading levels skip (h2 → h3 used as subtitle) |
| P1 | Unnamed controls: the logo link (image alt comes from a translation, but the mobile menu trigger has no label) and the WhatsApp floating link (icon only, no `aria-label`) |
| P1 | Form errors are not associated with inputs (`aria-describedby`, `aria-invalid`); the tracking error is plain red text with no live region |
| P1 | Shipment-type cards in the quote are `<button>`s acting as radio buttons, with no `role="radiogroup"` or `aria-pressed`/`aria-checked` |
| P2 | 33 interactive elements under 44 × 44 px at desktop (nav links, `size="sm"` buttons); worse on touch |
| P2 | `muted-foreground` (oklch 0.556) on `muted/50` backgrounds is borderline for small text; verify ≥ 4.5:1 |
| P2 | Spinner-only loading with no `aria-busy` or status text for screen readers |

### 1.6 Internationalisation
| Sev | Finding |
|---|---|
| P1 | Untranslated surfaces: the entire **portal** (keys exist in `messages.portal` but are unused), the **quote calculator** (English inside the French quote page, verified in the browser), login and register, dashboard, and status values ("In Transit") coming from the API |
| P2 | Dates rendered with `toLocaleDateString()` (browser locale, not the page locale) or as raw `2024-01-15`; currency built by hand (`€` + `toLocaleString()`) instead of `Intl.NumberFormat(locale, {currency})` |
| P2 | Metadata title and description are English-only and identical for every page |

---

## 2. Page-by-page

### 2.1 Homepage `/[locale]`
**What works:** clean whitespace, readable body copy, working language switch, WhatsApp shortcut (valuable for the diaspora audience).

**Problems**
- P0 Hero: invisible on load, empty in SSR, CTAs dead, generic value proposition.
- P0 Fake testimonials, stats and case study.
- P1 Six generic services (supply chain management, international trade...) that may not reflect real offerings. The real ones (barrels, personal effects, vehicles) are absent.
- P1 No **tracking input** or **quote starter** above the fold. These are the two highest-intent actions.
- P1 Contact form looks functional but has no `<form>` element and sends nothing. Users will believe they have contacted the business.
- P2 Very long page of stacked fade-ins with no clear narrative (what we ship → where → how it works → price → trust → contact).

**Recommended structure**
1. Hero: plain-language promise ("Ship from Ireland to Cameroon: barrels, parcels, vehicles and cargo"), with a **two-tab widget: _Get a quote_ | _Track_** and a WhatsApp secondary CTA.
2. What we ship: cards for confirmed services only, each linking to a service page.
3. Routes and transit times: honest ranges per mode ("Sea: 6–8 weeks", once confirmed).
4. How it works: four steps (quote → drop-off/collection → we ship and clear customs → delivery or collection in Douala/Yaoundé).
5. Trust: real reviews (Google/Trustpilot) or none; registered business details; insurance and customs facts.
6. FAQ: prohibited items, packing barrels, customs duties, payment.
7. Contact: phone and WhatsApp per country, opening hours, depot addresses, a working form.

### 2.2 Quote `/[locale]/quote`
**What works:** the live estimate concept; shipment type as visual cards; fixed origin keeps scope clear.

**Problems**
- P0 Submission fails (the API is unreachable), and the UI **shows no error**: the button stops spinning and nothing happens. The failure is only logged to the console.
- P0 Estimate shown ≠ price stored server-side (e.g. €203 vs €100 for 10 kg to Cameroon); both are invented.
- P1 Layout order fights the task. A large empty "Quote Calculator" placeholder comes first; type selection sits in a narrow left column, separate from the details; the selected-type summary appears *below* the form.
- P1 Origin is a read-only field (wasted space and visual noise); destination is an 80-country `Select` with no search, lowercase-derived names ("Congo kinshasa"), duplicates, and Sri Lanka listed as Africa.
- P1 Dimensions are a free-text field that only parses `×` (U+00D7). Typing `100x50x30` silently drops the volume charge. Use three numeric inputs.
- P1 No inline validation, no units help, no min/max (negative weight accepted), no per-type fields (vehicle make, model and year; barrel count; container size 20'/40'; personal-effects inventory).
- P1 Submit stays disabled until a type is chosen, with no explanation.
- P2 Success screen "Back to Home" uses `window.location.href = "/"` and drops the locale; the success message promises "within 24 hours" (unconfirmed SLA ❓).
- P2 The estimate disclaimer is a small badge; "Estimated total" vs "final price" needs clearer separation.

**Recommended pattern (Eurosender-inspired interaction, not its layout or branding)**
- **Stepper** with persistent progress: 1 Route → 2 What are you sending (service cards) → 3 Items (dynamic per service: barrels × size, boxes with L/W/H/kg, vehicle details, container type) → 4 Options (collection/drop-off, insurance, delivery vs collection at destination) → 5 Contact → 6 Review and submit.
- Sticky **price summary** on desktop and a bottom sheet on mobile, updating as fields change, showing *what's included*, *what's not* (destination duties), and "Estimate: confirmed by our team within X h" if pricing is not fully automatic.
- Show **volumetric weight** explicitly when it exceeds actual weight.
- Save the draft locally between steps; prefill contact details for logged-in users.
- Error summary at the top plus inline field errors on blur; never lose input on failure.

### 2.3 Tracking `/[locale]/track`
**What works:** single focused input, auto-uppercase, clear "not found" message.

**Problems**
- P0 Every lookup fails today (API redirected), so demo numbers show "not found", which is misleading.
- P0 Event icons never render (string vs component).
- P1 The server **fabricates** "Package continues in transit" events. A customer would be told false information.
- P1 Timeline is a flat list of free-text events, newest last, with no notion of milestones, what's next, or delays. Status values are English strings.
- P1 "Download invoice" and "View documents" buttons on a public page are dead and should require login anyway. "Track another shipment" does nothing.
- P2 No deep link (`/track/ML123...` or `?ref=`) to share or bookmark; can't be linked from emails.
- P2 Timestamps in browser locale and timezone, with no timezone shown.

**Recommended pattern (iContainers milestones + Tudor-style communication, Royal Mail clarity)**
- Header: reference number, **plain-language status sentence** ("Your barrels have left Dublin Port and are on the way to Douala"), and expected arrival as a range.
- **Milestone stepper** (horizontal on desktop, vertical on mobile): Booked → Received at depot → Departed Ireland → Arrived Douala → Customs cleared → Ready for collection / Out for delivery → Delivered. Completed, current and upcoming states are distinct, with an exception state (held at customs, delayed).
- Below it, a detailed event log (newest first) with local times and the timezone.
- "What happens next" and "Need help?" panels with WhatsApp per country.
- Opt-in to email/WhatsApp updates (once D-12 is decided).
- Public view hides names, addresses and prices; logged-in customers see documents.
- URL-addressable: `/[locale]/track/[reference]`.

### 2.4 Client portal `/[locale]/portal`
**Problems:** P0 publicly accessible with fake data; P1 English only, even though keys exist; P1 every action button is dead (Settings, New Quote, Filter, Track, Invoice, View, Book); P1 the tab control is not an accessible tablist; P2 search filters only some fields; P2 dates are raw ISO and data is from 2024; P2 the documents empty state CTA "Create New Shipment" goes nowhere.

**Recommended:** an authenticated area with an overview (active shipments with milestone mini-stepper, quotes awaiting action, documents needing upload), Shipments, Quotes, Documents, Addresses and Profile. Proper loading skeletons, empty states with one clear action, and error states with retry. Mobile: cards instead of tables, bottom-reachable primary action.

### 2.5 Staff dashboard `/[locale]/dashboard`
**Problems:** P0 public; P0 the unmodified shadcn demo (Playground, Models, Acme Inc, "Building Your Application / Data Fetching"); P1 the site navbar is overlaid on it.

**Recommended:** move it to `/[locale]/admin` with its own layout (no marketing navbar). Quote inbox (new / priced / sent), shipment board by milestone, bulk milestone update per consignment, customer search, rate-card editor, payments ledger, audit log. Dense table layouts are acceptable here, but keep keyboard access and visible focus.

### 2.6 Login and register `/[locale]/(auth)/*` (uncommitted)
**Problems:** P0 the form does nothing; P1 two stacked headings ("Create an account" and "Welcome back") on the same page; P1 register is a byte-for-byte copy of login; P1 "Continue with Vercel / Next.js" fake SSO; P1 English only on `/fr/login`; P1 inputs have placeholders but **no labels**; P2 hiding the global navbar via a global `style jsx` is fragile; P2 Terms and Privacy link to `#`.

**Recommended:** separate login, register and reset pages with visible labels, password visibility toggle, magic-link option, clear error copy that doesn't reveal whether an account exists, and the brand panel with real imagery or the logo. Use the route-group layout instead of CSS hiding.

### 2.7 Contact section and footer
- Contact form: P0 non-functional (see 2.1). Make it a real server action with validation and a success state, or replace it with direct WhatsApp/phone/email actions until email exists.
- Footer: P1 template content and dead links. Replace with: services, track, quote, company, legal, contact per country, social links (if any), registered business info.

### 2.8 Mobile (code review, verify on device)
- Navbar collapses at `lg` into a Sheet; the mobile trigger has no accessible label; menu links lack locale.
- Shipment-type cards stack above a long form, with no step progress, so the user scrolls a long way before entering details.
- The WhatsApp FAB (`bottom-6 right-6`, 56 px) may cover the submit button and last form fields on small screens. Add bottom padding or hide it on form pages.
- Portal cards: the action buttons are `size="sm"` (~32 px), below touch-target guidance.
- Contact form uses `flex gap-4` for first/last name with no wrap, which is cramped at 360 px.

---

## 3. Competitor reference patterns (learn, don't copy)

| Reference | Pattern to adopt | How it applies here |
|---|---|---|
| **Royal Mail** (clarity) | Track and Send as the first two actions; very plain language; one task per screen; strong focus states | Top-level "Track" and "Get a quote" in header and hero; plain status sentences |
| **Eurosender** (quotation) | Route first, then item type, then dimensions with live price; transparent options; clear review step | Stepper quote flow with sticky price summary and volumetric-weight explanation |
| **Tudor** (shipment communication) | Proactive status messages; "what happens next"; human contact surfaced | Status sentence plus next-step panel; email/WhatsApp updates per milestone |
| **iContainers** (freight milestones) | Port-to-port milestone timeline; ETD/ETA; container-level events | Milestone stepper with sea-freight stages (depot → port → vessel → Douala → customs) |

Don't reuse their names, logos, colours, illustrations, copy or exact layouts.

---

## 4. Recommended redesign direction

**Positioning:** "The reliable bridge between Ireland and Cameroon." The site should feel personal, trustworthy and practical for diaspora families and small businesses, not like a generic global-enterprise logistics template.

- **Visual language:** one confident brand colour (proposal: deep ocean/navy for trust, with a warm accent for CTAs, for example amber or terracotta, nodding to the Cameroon route without using flag colours literally). Neutral surfaces, borders before shadows, and a restrained 4/8 px spacing rhythm.
- **Typography:** one well-hinted sans with strong French diacritic support (e.g. Inter, Source Sans 3 or Manrope) loaded via `next/font`. Modular scale with 16 px minimum body text.
- **Imagery:** real photos of depots, barrels, loading and containers (owner to supply); no stock "global network" imagery.
- **Motion:** content visible immediately. Only subtle 150–250 ms transitions on interaction, and none under reduced motion.
- **Components:** one header (Track · Get a quote · Services · Help · EN/FR · Sign in), a two-tab hero widget, service cards, milestone stepper, status badge set (with icon + text, never colour alone), price summary, form field with label, help and error, empty/error/loading states.
- **Tone:** bilingual, plain, honest about timelines and customs duties; no invented numbers.

---

## 5. Prioritised fix list

| # | Sev | Fix | Phase |
|---|---|---|---|
| 1 | P0 | Restore API reachability; show submit errors to users | 0 |
| 2 | P0 | Remove fabricated testimonials, stats and case study | 0 |
| 3 | P0 | Wire hero and about CTAs to real routes | 0 |
| 4 | P0 | Make hero content visible without delay and render it in SSR | 0–1 |
| 5 | P0 | Contact form: make it work or replace it with direct contact actions | 0 |
| 6 | P0 | Hide or protect portal and dashboard | 0 |
| 7 | P1 | Unify brand name and logo; replace template footer and login text | 0–1 |
| 8 | P1 | Brand tokens, loaded font, type scale, reduced motion | 1 |
| 9 | P1 | Locale-aware links; translate portal, calculator and auth | 1 |
| 10 | P1 | Track and Quote promoted to top-level navigation and hero | 1 |
| 11 | P1 | Stepper quote flow with server-authoritative pricing | 4 |
| 12 | P1 | Milestone tracking with real events and a deep link | 7 |
| 13 | P2 | Touch targets, heading order, accessible tabs and radio group | 1 |
| 14 | P2 | `Intl` date and currency formatting by locale | 1 |
