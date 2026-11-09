# Project completion audit

- **Date:** 2026-11-09.
- **Branch:** `feat/project-completion`, based on `master` at `b6a0cce`, the live production commit.
- **Scope:** the original business requirements, checked against the code, the local tests and read-only checks of the live site.
- **Rules followed:** no production action was taken. No settings, users, emails, DNS, migrations, pushes or deployments were changed.

**Status levels:**

- **Implemented:** code exists on this branch.
- **Tested locally:** covered by automated tests run in this audit (unit, PGlite, real local Supabase, Playwright production build, full-stack journeys).
- **Verified in production:** observed on https://marchelo-logistics.com with read-only requests.
- **Outstanding:** work or decisions still required.

Production today:

- Supabase has 0 users and public sign-up is disabled.
- `ENABLE_TRANSACTIONAL_EMAIL=false`.
- Quote submission is disabled (the page says "Online requests are temporarily unavailable").
- `robots.txt` disallows indexing, because this is not a `RELEASE_BUILD`.

Because no account exists in production, **no signed-in workflow has been verified in production yet**.

---

## A. Feature matrix

| # | Feature | Implementation (main files / routes) | Tested locally | Verified in production | Problems / gaps | Work required |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Registration, login, password recovery | `app/[locale]/(auth)/*` (login, register, forgot-password, reset-password), `actions.ts`, `/api/auth/callback`, Supabase templates in `supabase/templates` | Yes: Supabase tests (sign-up closed, invites, sign-in), journeys (closed registration G, recovery), e2e | Partly: login form renders; register shows "Accounts are created by invitation"; portal redirects to login. Sign-in and recovery cannot be tried (no users). | Recovery and invite emails use Supabase's built-in mailer until custom SMTP is set | First admin (B); custom SMTP (C); production sign-in and recovery test after approval |
| 2 | Customer dashboard and profile | `app/[locale]/portal/*` (overview, quotes, shipments, documents, profile) | Yes: journeys, Supabase RLS tests | No (needs a customer account) | None known | Production test with an invited test customer |
| 3 | Quote request workflow | `/quote` wizard (`components/quote/quote-wizard.tsx`), `quote/actions.ts`, `/api/quote`, `lib/domain/quote-schema.ts`, `quote-lifecycle.ts` | Yes: unit, PGlite, e2e (validation, disabled state), journeys (submission end to end) | Disabled state verified ("temporarily unavailable") | Reviewer decided (P-01, 2026-11-09): the owner reviews every request and replies personally. `quoteSubmissionStatus()` (in `lib/config/env.ts`) needs **all three**: `ENABLE_QUOTE_SUBMISSION=true`, a database, and a working email transport (`ENABLE_TRANSACTIONAL_EMAIL=true` with `RESEND_API_KEY` and `EMAIL_FROM`). Production has email off, which alone keeps the form disabled. | First admin (B), owner address in `STAFF_NOTIFICATION_EMAIL`, email activation (C), then enable both flags |
| 4 | Configurable pricing | `lib/domain/pricing.ts` (exact integer arithmetic, re-verified in SQL), `ownerConfig.pricing.taxRatesBp`, EUR and XAF | Yes: unit tests and DB function parity tests | No | No price list, by directive (staff price each quote). Tax lines are disabled until P-03. | P-03 (VAT); optional standard-wording list |
| 5 | Staff quotation management | `app/[locale]/admin/(staff)/quotes`, `admin/quotes/[reference]`, `admin/actions.ts`, `lib/services/*` | Yes: integration, journeys | No | None known | Production test after the first admin |
| 6 | Quote acceptance and rejection | `/quote/view/[token]` (signed link), portal quote detail, `quote/view/actions.ts` | Yes: integration (including tampered token), journeys | No | None known | Production test |
| 7 | Shipment management | `admin/(staff)/shipments`, `admin/shipments/[reference]`, `shipment-lifecycle.ts` | Yes | No | None known | Production test |
| 8 | Public tracking | `/track`, `/track/[reference]`, `/api/track` (rate-limited, customer-visible milestones only) | Yes: e2e and journeys | Page renders (200) | None known | Production test with a real shipment |
| 9 | Status updates | Milestones (`MilestoneCode`), customer-visible or internal flag, ETA with visibility flag | Yes | No | T-01 and T-02 wording not confirmed | T-01, T-02 |
| 10 | Customer notifications | Outbox triggers write to `email_deliveries`; templates `quote_received`, `quote_under_review`, `info_requested`, `quote_issued`, `quote_updated`, `quote_expiring`, `quote_expired`, `quote_accepted`, `quote_declined`, `shipment_confirmed`, `shipment_update`, `shipment_delivered`, `contact_received` (EN/FR) | Yes: integration, email previews, live harness to the test inbox (`[EMAIL TEST]`) | Disabled (`ENABLE_TRANSACTIONAL_EMAIL=false`); 0 emails queued or sent | Retries depend on the next user action or the daily cron (see C) | Activation checklist (C) |
| 11 | Staff notifications | Templates `staff_new_request`, `staff_customer_message`, `staff_quote_accepted`, `staff_quote_declined`, `staff_shipment_exception`, `staff_contact`, `staff_role_changed`, `staff_email_failure`, `staff_job_failure` (EN), sent to `STAFF_NOTIFICATION_EMAIL` | Yes | Disabled | The owner reviews quotations (P-01), so `STAFF_NOTIFICATION_EMAIL` in Vercel must be the owner's notification address (currently the business mailbox) | Set it in Vercel (production setting, needs approval) |
| 12 | Contact enquiries | `/contact` form, `contact/actions.ts`, `admin/(staff)/enquiries` | Yes | Page and details verified (both locations, tel: and mailto: links) | Submission needs the database and the email flag as for quotes | Production test |
| 13 | Admin dashboard | `app/[locale]/admin/*` (dashboard, quotes, shipments, customers, enquiries, notifications, audit, users) | Yes | Redirect to login verified | No admin exists | B (first admin) |
| 14 | Roles and permissions | `requireRole` / `pageStaff`, `assertAdmin`, `admin_set_user_role` (advisory lock, last-admin guard), RLS, role-change trigger | Yes: Supabase RLS tests, provisioning tests (self-elevation blocked) | Partly: sign-up disabled confirmed in Supabase settings | None known | — |
| 15 | English and French | next-intl, `messages/en.json` and `fr.json` (927 keys each, parity enforced by `scripts/check-i18n.mjs`) | Yes | Yes: `/en` and `/fr` pages | None known | Owner proofreading of the French (optional) |
| 16 | Responsive layout | Tailwind; mobile menu | Yes: Playwright desktop and Pixel 7, overflow checks, axe | Pages render | None known | — |
| 17 | Cookie consent | **New:** `lib/consent/consent.ts`, `components/consent/*`, footer "Cookie preferences", `/cookies` page | Yes: 5 unit and 16 e2e tests (desktop and mobile) | **Not deployed** (this branch) | — | Approve, then release |
| 18 | Privacy and legal pages | `/privacy` (draft notice), `/terms` (404 until L-01), **new** `/cookies`; drafts in `docs/legal/` | Yes: e2e | `/privacy` live with draft notice | Seven drafts need owner and legal review | Section E |
| 19 | Security | CSP with nonce, security headers, HttpOnly session cookies, RLS, rate limits, signed quote links, Svix-verified webhook, secret guard for `.env.example`, `EMAIL_TEST_RECIPIENT` blocked on Vercel | Yes: security tests, `scripts/check-security.mjs` | Headers verified on the live site | Admin Gmail remains in 4 old public commits (history not rewritten) | Optional: decide whether to rewrite history |
| 20 | Business configuration | `config/owner.ts` (contacts, locations, routes, confirmed services, tax rates, legal flags), feature flags in `lib/config/env.ts` | Yes: quality gates | Contacts, services and routes live | 4 owner markers remain, all legal (section F) | Section F |

---

## B. First administrator procedure

The full runbook is [docs/runbooks/first-admin.md](runbooks/first-admin.md). In summary:

- **Tool:** `scripts/provision-admin.mjs` (`npm run admin:provision`).
  - Operator-only; there is no web route. It refuses to run on Vercel.
  - It reads secrets from the shell and never prints them.
  - Dry run by default; `--apply` to act.
- **Hosts:** it refuses any hosted project unless `ALLOW_PROVISION_HOSTS` names both the Supabase API host and the database host exactly.
- **One time only:** it refuses if any administrator exists, checked again under the same advisory lock as `admin_set_user_role`.
- **New address:** sends a Supabase invitation and assigns the admin role through the trusted path. The owner chooses their own password. The role change is audited.
- **Existing account:** promoted without sending email.
- **Tests:** 6 tests against real local Supabase (`tests/supabase/provision-admin.test.ts`).
- **Production run:** prepared, **not executed.** It needs:
  - the owner's approval;
  - the owner's confirmed address, typed on the command line only (it is never committed);
  - the URL configuration and invite template checked in Supabase.

---

## C. Email readiness checklist

**Already in place (code, tested locally):**

- Templates exist in EN and FR for customers; staff alerts are in EN. HTML and plain text are rendered by React Email.
- Every link comes from `SITE_URL`. The email-previews test fails on any leftover placeholder.
- Customer emails go to the stored customer address. Staff alerts go only to `STAFF_NOTIFICATION_EMAIL` (comma-separated, up to 10), resolved at send time and never stored.
- The outbox is transactional (written by triggers):
  - rows are claimed with `FOR UPDATE SKIP LOCKED`;
  - idempotency keys are passed to Resend;
  - up to 5 attempts with backoff of 1 min, 5 min, 30 min, 2 h and 12 h, after which the row is DEAD and one staff alert is sent;
  - staff alerts never trigger further alerts (no loops).
- The Resend webhook is verified by Svix. It handles delivered, delayed, bounced and complained events, is safe to replay, and alerts staff on bounces and complaints.
- `EMAIL_TEST_RECIPIENT` is a local-only override with an `[EMAIL TEST]` subject prefix. It is ignored on Vercel.
- `EMAIL_REPLY_TO` is supported.

**Gaps found in this audit:**

1. **Retry timing.** The backoff schedule assumes frequent runs. In production the outbox runs only after a user action (`after()`) and once a day (`45 3 * * *`, a Vercel Hobby limit). A failed email may wait up to 24 hours. Options:
   - a more frequent cron (Vercel Pro);
   - an external scheduler calling `/api/cron/process-emails` with `CRON_SECRET`;
   - accept the delay.

   **[OWNER]**
2. **Auth emails.** Invite, recovery and confirmation emails are sent by Supabase Auth, not by the app. Until custom SMTP is configured they come from Supabase's shared sender, which is rate-limited.

**Activation steps (production; each needs approval):**

1. Resend: create a **separate** API key restricted to sending for `marchelo-logistics.com`, for Supabase SMTP. Do not reuse the app's key.
2. Supabase → Authentication → SMTP:
   - host `smtp.resend.com`, port 465, user `resend`, password = the separate key;
   - sender `notify@…` (the confirmed sender, C-02), with sender name "Marchelo Logistics".
3. Supabase → Authentication → Email templates: paste the committed `supabase/templates/{invite,recovery,confirmation}.html`. Check that each link is `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=…`.
4. Supabase → URL configuration:
   - Site URL `https://marchelo-logistics.com`;
   - allow-list `https://marchelo-logistics.com/api/auth/callback**` (already set; verified in the earlier phase).
5. Vercel production env:
   - confirm `STAFF_NOTIFICATION_EMAIL`, `EMAIL_FROM` and `EMAIL_REPLY_TO` (optional);
   - `RESEND_WEBHOOK_SECRET` is set;
   - then `ENABLE_TRANSACTIONAL_EMAIL=true`.
6. Resend → Webhooks: the endpoint `https://marchelo-logistics.com/api/webhooks/resend` with events delivered, delivery_delayed, bounced and complained (verify it is present).
7. Redeploy. This is a production action.

**End-to-end test plan (after activation, test addresses only):**

| Step | Expected result |
| --- | --- |
| Admin invites a test customer (an owner-controlled inbox) | The invite arrives from the custom sender; the link opens `/<locale>/reset-password`; the password is set |
| Forgot password for the test customer | The recovery email arrives; the link works once; reusing it fails |
| The test customer submits a quote (after P-01) | `quote_received` goes to the customer; `staff_new_request` goes to the staff inbox |
| Staff send a quote | `quote_issued` arrives, with a working signed link |
| Customer accepts | `quote_accepted` goes to the customer; `staff_quote_accepted` goes to staff |
| Staff create a shipment and add a visible milestone | `shipment_confirmed` and `shipment_update` arrive |
| Contact form | `contact_received` goes to the sender; `staff_contact` goes to staff |
| Admin → Notifications | All rows are SENT, then DELIVERED by the webhook |
| Bounce test with Resend's `bounced@resend.dev` (staff-created test customer only) | The row is BOUNCED and a staff alert is received |

---

## D. Cookie plan and inventory

Implemented on this branch; see [docs/legal/cookie-policy.md](legal/cookie-policy.md).

**Verified inventory:** all strictly necessary.

- `NEXT_LOCALE`;
- `ml_consent`;
- `sb-…-auth-token` (after sign-in);
- `sb-…-auth-token-code-verifier` (during password reset).

There are no analytics, advertising or third-party scripts, and the CSP blocks them anyway.

**Consent manager:**

- the banner offers Accept all, Reject optional cookies and Customise; Accept and Reject look the same;
- categories: necessary (locked), functional, analytics, marketing; nothing optional is pre-ticked, and each optional category is labelled "not used at present";
- the choice and the policy version are stored for 180 days;
- the footer "Cookie preferences" link reopens the dialog to change or withdraw consent;
- EN and FR; mobile and desktop;
- axe-clean.

**Honest position:** a banner alone does not make the site compliant, and none is legally required today because only strictly necessary cookies are used. The mechanism exists so that any future optional tool can be added correctly. Wording review: L-04.

---

## E. Legal drafts (EN and FR)

See [docs/legal/README.md](legal/README.md).

- **Drafted in full (both languages, with markers):**
  - Privacy notice;
  - Terms and conditions;
  - Shipping policy;
  - Payment, refund and cancellation;
  - Customs and prohibited goods;
  - Claims and complaints.
- **Cookie policy:** the inventory and the live `/cookies` page.

**None is approved.** Only `/privacy` and `/cookies` are public, both with a draft notice. `/terms` stays at 404 until L-01.

---

## F. Owner decisions and placeholders

**Code markers (`{{NEEDS_OWNER}}`, 4).** C-01 (WhatsApp, opening hours), S-01 (services) and P-01 (reviewer) were answered on 2026-11-09. The remaining markers:

- terms (L-01);
- privacy (L-02);
- cookie policy (L-04);
- one in `config/retention.ts` (L-03).

A `RELEASE_BUILD=true` build fails until they are resolved.

**Information to confirm:**

| Topic | Decision | Needed for |
| --- | --- | --- |
| Legal identity: name, form, registration, VAT, controller | B-02, L-02 | Privacy, Terms, footer |
| Drop-off address, if different from the Lucan office | Shipping policy | Shipping policy |
| Destination cities | S-02 | Quote form |
| Prohibited and restricted goods | S-03 | Customs policy, FAQ |
| Online quotes for the three support services, and their questions | S-04 (proposal ready) | Quote form |
| Collection service: offered? areas? charges? | new: Shipping policy | Shipping policy |
| Response-time wording (the reviewer is decided: the owner) | P-01 (remaining part) | Quote confirmation text (optional) |
| Currencies, VAT presentation, validity | P-03 | Tax lines |
| Customs duties included or not | P-04 | Quotes, Customs policy |
| Payment methods, deposit, due date | P-05 | Payment policy |
| Refund rules | P-06 | Payment policy |
| Milestones and delivery-estimate policy | T-01, T-02 | Tracking, Shipping policy |
| Staff notification inbox, sender address | C-02 | Email activation |
| Retention periods | L-03 | Privacy, automatic deletion |
| Liability, insurance, carriage regime | L-05 | Terms, Claims |
| Distance-contract cancellation right | L-06 | Payment policy |
| Claim deadlines, complaint process, ADR | L-07 | Claims policy |
| Cookie policy wording | L-04 | `/cookies` |
| Retry cadence (cron) | new: section C | Email reliability |
| First administrator: approval of the procedure | B | Everything signed-in |
| Launch approval (indexing, `RELEASE_BUILD`) | R-03 | Go-live |

---

## G. S-04 migration proposal

See [docs/proposals/S-04-service-codes.md](proposals/S-04-service-codes.md).

- **The change:** additive `ALTER TYPE … ADD VALUE` for `customs_clearance`, `warehousing` and `ecommerce`.
- **Safety:** existing rows are untouched, it is backward compatible, and the values are irreversible.
- **Application work:** schema, form branches, EN/FR and tests.
- **Pricing:** unchanged. No rates are invented. VAT and customs treatment per service are owner and accountant questions.
- **Status:** **not created and not applied.**

---

## H. Prioritised plan

| Priority | Item | Owner input | Production action |
| --- | --- | --- | --- |
| 1 | Review and merge this branch (cookie consent, `/cookies`, provisioning tool, docs) | Approve | Merge and deploy (approval) |
| 2 | Create the first administrator (runbook B) | Approve, confirm the address | Yes |
| 3 | Custom SMTP plus the auth templates in Supabase | C-02 sender | Yes |
| 4 | Production sign-in, recovery and invite test with a test customer | — | Yes (test accounts) |
| 5 | Decide P-01, then enable quote submission and transactional email; run the email E2E plan | P-01, C-02 | Yes |
| 6 | Legal review of the drafts, then publish (flags `termsApproved`, `privacyApproved`, `cookiePolicyApproved`) | B-02, L-01 to L-07, P-03 to P-06 | Deploy |
| 7 | S-04 implementation | Section 5 of the proposal | Migration on deploy |
| 8 | Backups (deferred), monitoring, retry cadence | Plan choice | Yes |
| 9 | Launch: `RELEASE_BUILD=true` (indexing on), Search Console, sitemap submission | R-03 | Yes |

## I. Remaining effort and blockers

| Item | Developer effort | Blocked by |
| --- | --- | --- |
| Merge and release this branch | 0.5 day including production smoke checks | Approval |
| First admin and production auth tests | 0.5 day | Approval, owner availability to accept the invite |
| SMTP and email activation, E2E email tests | 0.5 to 1 day | C-02, P-01 |
| Publishing the legal pages (turning approved text into pages) | 1 to 2 days | Lawyer and owner answers |
| S-04 | 1.5 to 2 days | Owner answers (proposal section 5) |
| Launch tasks (indexing, monitoring, backups) | 0.5 to 1 day | R-03, hosting plan |

**Completed and tested locally:** all 20 functional areas.

**Verified in production:** public pages, contacts, services, security headers, the disabled and closed states, the login form.

**Not verified in production:** every signed-in workflow, and email. Both wait on B and C.

---

## Launch checklist

- [ ] Backups: Supabase PITR or daily backups enabled (deferred decision recorded in `DEPLOYMENT.md`); test restore to a scratch project.
- [ ] Monitoring:
  - Vercel deployment notifications;
  - an uptime check on `/en` and `/api/track`;
  - Supabase usage and auth-log alerts;
  - Resend bounce and complaint rates;
  - `staff_job_failure` alerts arriving.
- [ ] Cron: `CRON_SECRET` set; both crons visible in Vercel; first runs succeed.
- [ ] Indexing: `RELEASE_BUILD=true` only at launch (R-03); `robots.txt` allows indexing; the sitemap on the official domain; Search Console verified (DNS TXT record, approval needed).
- [ ] Production verification after each deploy:
  - every public route returns 200;
  - `/terms` returns 404 until approved;
  - security headers are present;
  - the consent banner appears in a fresh browser;
  - the login form works for the test account;
  - no `{{NEEDS_OWNER}}` text is visible.

## Test plan (automated; run in this audit unless noted)

| Area | Where | Result |
| --- | --- | --- |
| Registration blocked, login, recovery, invitations and roles | `tests/supabase/auth-and-rls.test.ts`, journeys G and recovery | Supabase suite: 22 passed, 3 skipped (the open-registration tests are skipped while registration is closed) |
| First-admin provisioning, self-elevation blocked | `tests/supabase/provision-admin.test.ts` | 6 passed |
| Admin authorisation and data isolation (RLS) | `tests/supabase/*`, `tests/integration/*` | See the regression run |
| Quotes, pricing, acceptance and rejection, shipments, tracking | `tests/unit`, `tests/db`, `tests/integration`, journeys | See the regression run |
| Emails (outbox, webhook, override, reply-to) | `tests/integration/email*.test.ts` | See the regression run |
| Cookie consent and withdrawal | `tests/unit/consent.test.ts`, `tests/e2e/consent.spec.ts` | 5 and 16 passed |
| EN/FR parity | `scripts/check-i18n.mjs`, e2e | 927 keys each |
| Mobile, accessibility, CSP, public pages | `tests/e2e/public.spec.ts` | 122 passed, 4 skipped (whole public e2e suite) |
