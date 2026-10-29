# Marcel Logistics — Decision Register

_Last updated: 2026-10-29 · Supersedes the first version of this file (same D-numbers are kept so the roadmap references remain valid)._

Related: [OWNER-QUESTIONNAIRE.md](./OWNER-QUESTIONNAIRE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [PHASE-0-PLAN.md](./PHASE-0-PLAN.md) · [PHASE-1-REDESIGN-SPEC.md](./PHASE-1-REDESIGN-SPEC.md) · [IMPLEMENTATION-ROADMAP.md](./IMPLEMENTATION-ROADMAP.md)

**Rule:** nothing marked _Owner_ may be guessed in code or copy. Until a decision is recorded, the interface must use neutral wording or hide the section.

## How to read this register

- **Type:** _Owner_ means a business decision that needs owner approval. _Tech_ means a technical decision where we give a recommendation, and owner sign-off is only needed for cost or vendor.
- **Blocks:** the earliest phase that cannot be completed without the decision.
- **Priority:** P1 is needed now (Phase 0/1). P2 is needed before the data and auth phases. P3 is needed before later phases.
- **Status:** ⏳ open · ✅ decided · ↪ defaulted (a safe default applies until the owner overrides it)

---

## 1. Register (sorted by priority)

| ID | Pri | Type | Decision | Blocks | Recommendation / safe default | Status |
|---|---|---|---|---|---|---|
| **D-19** | P1 | Owner + Tech | What to do with the **uncommitted work**: the `(auth)` route group and the moved login page | Phase 0 commit | Keep it. Commit it as a separate "WIP: move auth pages into route group" commit before any Phase 0 commit, so history stays clean. Fix its content in Phase 1 | ⏳ |
| **D-22** | P1 | Owner | **Git workflow and authority:** may we create a branch, commit, and open PRs? Who reviews? | Phase 0 | Work on `phase-0-stabilisation`, one commit per task, PR to `master`, owner merges. No direct pushes to `master` | ⏳ |
| **D-20** | P1 | Owner | Relationship to the **live WordPress site** at `marchelo-logistics.com` (Hostinger; title "Home - Marchelo Logistics") | Any deployment | Treat WordPress as production. The Next.js app must not replace it until a migration plan is approved (content, URLs/redirects, email, DNS) | ⏳ |
| **D-4** | P1 | Owner | **Remove fabricated content now?** (testimonials, stats, case study, "guaranteed", "24 hours", "real-time", "insurance") | Phase 0 | Yes: hide the sections and use neutral wording until real, consented content is supplied | ⏳ |
| **D-1** | P1 | Owner | **Official trading name**, legal entity, logo, domain, contact email | Phase 0 (copy), Phase 1 (brand) | Until decided, Phase 0 standardises nothing; it only removes the misspelling "Machelo". No guessing between "Marcel" and "Marchelo" | ⏳ |
| **D-21** | P1 | Owner | **Interim handling of quote and contact requests** until a database and email exist (about Phase 3–5) | Phase 0 (forms) | Forms say clearly that online submission is temporarily unavailable, and offer WhatsApp, phone and email links. No form that silently discards data | ⏳ |
| **D-17** | P1 | Tech | **Next.js security patch** | Phase 0 | Upgrade `next` and `eslint-config-next` 15.5.0 → **15.5.28**, plus patch versions of `next-intl`, `zod`, `react`/`react-dom` 19.1.x. No major upgrade now. See ARCHITECTURE §2.1 | ↪ |
| **D-2** | P1 | Owner | **Services and routes operating today** (and the "coming soon" ones) | Phase 1 content, Phase 4 forms | Show only confirmed services. Unconfirmed ones aren't listed or are labelled "on request" | ⏳ |
| **D-23** | P1 | Owner | **Brand assets:** logo files, colours (if any), photos of real operations | Phase 1 | If none exist, we propose a palette for approval. No stock imagery that implies facilities the business doesn't have | ⏳ |
| **D-3** | P1 | Owner | **Transit-time wording and response times** (quote reply time, sea/air ranges, schedules) | Phase 1 copy | No numbers until confirmed. Use "Our team will contact you" without a time promise | ⏳ |
| **D-15** | P1 | Tech | Dark mode | Phase 1 | Light theme only at launch; tokens prepared for dark mode | ↪ |
| **D-24** | P1 | Tech | Typeface | Phase 1 | Self-hosted via `next/font`: **Inter** or **Source Sans 3** (open licence, full French diacritics) | ↪ |
| **D-6** | P2 | Owner | **Quotation model** | Phase 4 | Request-a-quote with staff-reviewed quotes (no automatic price) until D-5 rate data exists. This is the user's instruction | ✅ (interim) |
| **D-8** | P2 | Owner | **Legal content:** terms of carriage, liability, prohibited items, privacy, cookies, company and VAT numbers | Phase 2, launch | Owner or solicitor drafts; we only provide page structure | ⏳ |
| **D-9** | P2 | Tech | **Database and ORM** | Phase 3 | PostgreSQL (EU region) + Drizzle; host Neon (if on Vercel) or Supabase. See ARCHITECTURE §2.3 | ⏳ needs cost sign-off |
| **D-11** | P2 | Tech | **Authentication** | Phase 6 | Better Auth or Auth.js v5, self-hosted; customers can quote and track **without** an account. See ARCHITECTURE §2.4 | ⏳ |
| **D-10** | P2 | Tech | **Transactional email** | Phase 5 | Resend (or Postmark), sending from the owner's domain. Needs DNS access (D-20) | ⏳ needs cost sign-off |
| **D-16** | P2 | Owner + Tech | **Hosting for the Next.js app** | Staging deploy | Vercel (EU region functions) for app hosting; DNS stays where it is until migration. Alternative: Node hosting on the existing provider. See ARCHITECTURE §2.2 | ⏳ |
| **D-25** | P2 | Owner | **File uploads in quote requests** (photos, invoices, IDs)? Which documents? | Phase 5 | Optional photo and document upload, private storage, 10 MB each, PDF/JPG/PNG | ⏳ |
| **D-14** | P2 | Tech | Spam protection | Phase 4 | Honeypot + server rate limiting; add Cloudflare Turnstile if abused | ↪ |
| **D-13** | P2 | Owner | Analytics | Phase 2 | Cookieless analytics, or none (avoids a consent banner) | ↪ |
| **D-5** | P3 | Owner | **Rate tables** (units, minimums, surcharges, currency, VAT, duties) | Automatic pricing (deferred) | Not before written approval of real rates | ⏳ |
| **D-12** | P3 | Owner | Customer notification channels (email / SMS / WhatsApp Business) | Phase 7 | Email first | ⏳ |
| **D-7** | P3 | Owner | **Online payments** (who pays, deposits, card, bank, mobile money) | Phase 10 | Out of scope until requested | ⏳ |
| **D-18** | P3 | Tech | Removing unused or template code (`navigation.tsx`, uploader, dashboard demo, merged feature branch) | Phase 1+ | Remove each only after its replacement exists, in its own commit | ↪ |

---

## 2. Owner decisions: detail

The questions themselves are in [OWNER-QUESTIONNAIRE.md](./OWNER-QUESTIONNAIRE.md). This section explains why each one matters.

- **D-1 Identity.** The code uses three spellings ("Marcel", "Marchelo", "Machelo"). The live WordPress site uses "Marchelo Logistics". We must not choose for the owner. The choice affects the logo, domain, email sender identity, legal pages and SEO.
- **D-2 Services and routes.** The current app lists six generic services and 80+ countries, including Sri Lanka under "Africa". The business focus is Ireland → Cameroon. Every listed service creates a customer expectation and possible liability.
- **D-3 Time promises.** "Within 24 hours", "guaranteed delivery times" and "real-time updates" are in the copy today. They are commitments.
- **D-4 Social proof.** Invented testimonials labelled "Verified Customer" can breach consumer-protection law. Removal is low-risk and reversible (content stays in Git history).
- **D-6 / D-5 Pricing.** Approved interim model: **request-a-quote, staff-reviewed**. Automatic pricing is blocked until written rate data is approved.
- **D-7 Payments.** Affects legal entity, accounting and the countries of payers (Ireland vs Cameroon).
- **D-8 Legal.** Terms of carriage and liability limits must come from the owner or a solicitor. We will not draft legal claims.
- **D-19 / D-22 Repository.** Uncommitted work exists. We will not commit, discard or overwrite it without approval.
- **D-20 / D-16 Live site.** A production WordPress site exists. Replacing it involves content, URL redirects, the email currently tied to the domain (if any), and DNS. That needs a migration plan and explicit approval.
- **D-21 Interim requests.** Today, quote submissions fail (routing bug), and even when they work they are lost on restart (in-memory storage). Customers must not believe that a request reached the business when it didn't.
- **D-23 Brand assets.** Real photos and the official logo materially improve trust.
- **D-25 Uploads.** Uploaded IDs and invoices are personal data. Retention and access rules are needed (GDPR).

## 3. Technical decisions: summary

Full trade-offs, costs to verify, dependencies and consequences of alternatives are in [ARCHITECTURE.md §2](./ARCHITECTURE.md#2-technical-decisions).

| ID | Recommended | Main alternative | Why recommended |
|---|---|---|---|
| D-17 | Patch to Next 15.5.28 | Next 16.x now | Fixes all reported advisories with the least change |
| D-24 | Inter via `next/font` | Manrope / Source Sans 3 | Neutral, legible, full Latin-extended support |
| D-15 | Light only | Light + dark | Halves the visual QA surface at launch |
| D-9 | Postgres + Drizzle (Neon or Supabase, EU) | Prisma; Supabase all-in-one | Relational data, typed, reviewable SQL migrations |
| D-11 | Better Auth / Auth.js v5 | Clerk; Supabase Auth | No per-user cost; data stays in our DB |
| D-10 | Resend | Postmark; SES | Simple API, React Email templates |
| D-16 | Vercel (EU) | Hostinger Node / VPS | Native Next.js support; preview deployments for review |
| D-14 | Honeypot + rate limit | Turnstile | No third-party script until needed |

---

## 4. Unresolved risks and dependencies

| # | Risk | Impact | Likelihood | Mitigation | Owner of next step |
|---|---|---|---|---|---|
| R-1 | Owner answers are slow or incomplete | Phases 1–2 stall or ship with placeholders | Medium | Neutral copy and hidden sections let technical work continue. Questionnaire kept short | Owner |
| R-2 | Live WordPress site disturbed by a deployment or DNS change | Business loses its web presence or email | Low (if gated) | No DNS or domain change without an approved migration plan (D-20). Deploy Next.js to a separate preview URL only | Dev + owner |
| R-3 | Requests lost before a database or email exists | Lost customers; false confirmation | High today | Phase 0: forms show an honest "unavailable, contact us via…" state (D-21) | Dev |
| R-4 | Critical Next.js advisories (RCE) in 15.5.0 | Compromise if this build were ever deployed | High if deployed | Phase 0 patch to 15.5.28 before any deployment | Dev |
| R-5 | Patch upgrade introduces regressions (next-intl 4.3 → 4.14 is a large minor jump) | Broken locale routing | Medium | Upgrade in a separate commit; verify routes, locale switch and API with the same probes used in the audit | Dev |
| R-6 | Personal data exposure through `GET /api/quote` once the routing bug is fixed | GDPR breach | **High** if the routing is fixed first | Order matters: disable the listing endpoint **in the same change or before** fixing the matcher | Dev |
| R-7 | Unauthenticated tracking edits (`POST /api/track`) | False shipment information | High once reachable | Disable in Phase 0 until staff auth exists | Dev |
| R-8 | Legal claims or fake reviews remain live | Regulatory or reputational | Medium | D-4 removal in Phase 0 | Owner approves, dev executes |
| R-9 | Vendor costs exceed budget (DB, email, hosting, auth) | Rework | Medium | Verify current pricing before sign-off (ARCHITECTURE §3); prefer providers with free tiers and data export | Owner |
| R-10 | Mobile layout unverified (audit couldn't resize the browser) | Mobile issues found late | Medium | Phase 1 acceptance includes device or emulator checks at 360/390/768 px | Dev |
| R-11 | French copy quality | Poor experience for French-speaking customers | Medium | Fluent reviewer signs off on FR copy per phase | Owner names a reviewer |
| R-12 | **This development environment has TLS certificate checking disabled** (`NODE_TLS_REJECT_UNAUTHORIZED=0` inherited by the shell; not set at Windows user or machine level) | Package downloads could be intercepted (supply-chain risk) | Low–Medium | Find and remove the setting in the tool or editor config that sets it before running `npm install` for Phase 0 | Owner (machine owner) |
| R-13 | Uncommitted work mixed into Phase 0 commits | Unclear history; hard to review or revert | Medium | D-19 first | Owner |
| R-14 | WhatsApp link uses `wa.me/+353…`; WhatsApp's documented format leaves out the `+` | Link may fail on some clients | Low | Verify on Android, iOS and desktop; use `wa.me/353896160927` if confirmed by the owner | Dev |

### Dependency chain (what waits for what)

```
D-19, D-22 ───────────────► Phase 0 commits
D-4, D-21 ────────────────► Phase 0 content and form tasks
D-17 (+ R-12 resolved) ───► Phase 0 dependency upgrade
Phase 0 merged ───────────► Phase 1 starts
D-1, D-2, D-3, D-23 ──────► Phase 1 final copy and brand (layout work can start without them)
D-9, D-16 ────────────────► Phase 3 (data)  ──► request-a-quote persistence (Phase 4)
D-10 + DNS access (D-20) ─► Phase 5 (email) ──► quote confirmation emails
D-11 ─────────────────────► Phase 6 (auth)  ──► portal, admin, staff quote review
D-8 ──────────────────────► public launch
D-5 ──────────────────────► automatic pricing (deferred indefinitely)
D-7 ──────────────────────► payments
```
