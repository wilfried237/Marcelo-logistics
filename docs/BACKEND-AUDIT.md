# Backend functionality audit (2026-11-04, before the MVP completion phase)

Baseline: branch `feat/royal-mail-inspired-redesign` @ `a3b9a9f` (= `origin/master`). Production database migrated (4 migrations). Work for this phase happens on `feat/backend-mvp-completion`.

## 1. Implemented and tested
- Quote request submission without an account: Zod validation (server-authoritative), honeypot, idempotency key, persistent rate limits (5/h per client, 5/day per email), non-guessable `QR` + 6 base32 reference, both routes IE⇄CM.
- Quote lifecycle (SUBMITTED → UNDER_REVIEW → AWAITING_CUSTOMER → QUOTED → ACCEPTED/DECLINED/EXPIRED, CANCELLED) enforced by trigger and mirrored in TypeScript (one lifecycle, tested pairwise).
- Staff quote: single amount (integer minor units, EUR/XAF), inclusions/exclusions, validity; frozen once sent; QUOTED requires a sent quote; ACCEPTED requires a still-valid quote.
- Customer accept/decline for **signed-in** customers (`customer_respond_to_quote`, ownership checked in the database).
- Shipment creation from an accepted quote (owner/service derived by trigger), `ML` + 10 base32 reference, events with public/internal visibility, ETA shown only when staff approve it.
- Public tracking through an allowlisted `SECURITY DEFINER` function; unknown references indistinguishable.
- Auth (Supabase, invitation-only), roles customer/staff/admin, last-admin protection, RLS on every table, column grants, audit log (append-only, same transaction).
- Quote expiry job (idempotent, overlap-safe), retention job (dry-run only), cron bearer auth.
- Emails: acknowledgement, quote issued, shipment update, staff new request; Resend provider; idempotent `email_deliveries` log.

## 2. Partially implemented
- Emails are sent **inline after** the business transaction. A crash between commit and send loses the email silently; failures are recorded but **never retried**; no provider webhooks (delivery, bounce, complaint).
- Staff notifications: only "new request", to a single `STAFF_NOTIFICATION_EMAIL`.
- Staff quote list: status filter only; no search, sort, assignment, internal notes, information requests or history view.
- Shipment status: free-form update; **no transition rules** (a delivered shipment can go back to "in transit").
- Public tracking returns no origin/destination.
- Quote form: phone optional and without enforced country code; no privacy acknowledgement recorded.

## 3. Visual placeholders only
- Contact page: shows "details being confirmed"; there is **no contact form** and nothing is persisted.
- Customers without an account receive a quote email but **cannot open, accept or decline** the quote (the link points to the account-only portal).

## 4. Missing database functionality
Quote line items and auditable totals; case messages (internal notes, information requests, customer replies, shipment issue reports); request assignment; secure quote access for customers without an account; shipment transition rules; contact enquiries; job run records; email outbox state (attempts, next attempt, delivery events).

## 5. Missing API functionality
Secure tokenised quote view/accept/decline/reply; contact submission; Resend webhook endpoint; outbox processing job; staff search/filter/sort; notes/messages; assignment.

## 6. Missing email functionality
Templates for: under review, information requested, quote updated, expiring soon (if configured), expired, accepted, declined, shipment confirmed + tracking reference, delivered, contact received; staff alerts (customer reply, accepted, declined, shipment needed, shipment issue, delayed/on hold, delivery failures, job failures, security-sensitive admin actions). Plain-text and HTML for all; branded layout; outbox with retries and webhooks.

## 7. Missing business rules
Line-item pricing arithmetic and rounding; currency consistency per quote; tax only when an approved rate exists (P-03); shipment status transitions; notification deduplication.

## 8. Missing tests
Pricing engine; outbox/retry/webhook; tokenised access; contact form; shipment transitions; notification rules; email rendering in both languages; full-stack journeys (quote → staff quote → acceptance → shipment → tracking) against a real database.

## 9. Owner decisions blocking or shaping implementation
- **P-01 / C-02**: staff notification inbox and sender domain. Email stays disabled in production until both are confirmed; everything is built and tested with a fake provider.
- **P-03**: currencies (EUR, XAF stay selectable), VAT presentation; **no tax rate is configured**, so tax lines are unavailable until approved.
- **P-04**: customs duties: stated per quote in inclusions/exclusions.
- **P-02**: per-service information: current defaults kept.
- **C-01**: verified contact details: none, so email footers carry no phone/email.
- **C-03**: ~~registration stays invitation-only~~ → **answered 2026-11-04: open registration** with email verification (implemented; see section 10). Customers without accounts can still use secure quote links.
- **L-03**: retention: uploads and retention deletion stay disabled.
- **T-02**: no estimated delivery dates are generated.

## 10. Final verification and deployment-safety review (2026-11-04)
| # | Finding | Severity | Resolution |
|---|---|---|---|
| V-1 | Registration was closed at three levels (Supabase `enable_signup = false`, no email confirmation, flag off) although C-03 is now "open". Auth emails used PKCE links that only work in the browser that started the flow | Functional | Opened with mandatory verification; confirmation template; `token_hash` links for confirmation, invitation and reset; per-address sign-up limit tightened to 3/hour. Tests: 3 real-stack Auth tests, rate-limit test, journey G |
| V-2 | Soft 404 (HTTP 200) for another customer's request or shipment, and for staff opening unknown references | Low (no data exposed) | Detail pages moved outside the loading boundaries; strict 404 asserted in journey F |
| V-3 | Legacy email rows (old inline sender) would be picked up by the new outbox: sent late, retried with incompatible shapes, staff rows sent to a stored address as "customer" mail | **High for the migration** | Follow-up migration `20261104000100_outbox_legacy_rows`; upgrade rehearsal test |
| V-4 | Real hosted values in the working copy of the tracked `.env.example`; `!.env.example` removed from `.gitignore` | **High (not committed)** | Values moved unprinted to an ignored file, template restored, history scanned clean, guard added to `check:security` |
| V-5 | Every Vercel variable targets Preview and Production: a preview would use the production database | **High** | Documented (ENVIRONMENT.md); no Vercel change made; do not push or deploy Preview until fixed |
| V-6 | `SHADOW_DATABASE_URL` and `SEED_USER_PASSWORD` exist in Vercel | Low | Remove (owner) |
| V-7 | Outbox drains the oldest due rows first, 10 per action: a large backlog delays new emails until it is cleared (seen locally with stale test rows) | Low in production | Legacy rows closed (V-3); daily cron drains 25 per run, so on Hobby a big outage backlog takes days; a Pro plan with a 5–15 minute schedule fixes it |
| V-8 | Staff inbox | OK | Read only by `staffRecipients()`, used only for staff-audience rows, never stored, logged, shown or added to customer emails |
| V-9 | Supabase's built-in mailer is not suitable for production sign-ups | Blocking for C-03 go-live | Custom SMTP (C-02) is a prerequisite in the switch-on checklist |
