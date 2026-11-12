# Stage 5: shipment management

_2026-11-11, branch `feat/stage-5-shipment-management`, built on the production commit `0a3bf45` (Stage 4). Not merged, pushed or deployed. No production setting, record or email was touched. **No database migration.**_

## Audit: what already existed (reused, not rebuilt)

The backend MVP (November 2026) already built the shipment model. Stage 5 checked each requirement against the code and the database, and only filled the gaps.

| Requirement | Implementation | Enforced by |
|---|---|---|
| Unique shipment reference | `ML` + 10 characters (`^ML[A-Z2-7]{10}$`), random, retried on collision | Check constraint and unique index `shipments_reference_key` |
| Customer ownership | `customer_id` is **derived** from the accepted quote request by a trigger (`app_enforce_shipment_rules`); clients cannot write it | Trigger; column grants (only `status`, `eta_*` are updatable) |
| Original quote association | `quote_id` (one accepted, sent quote), `RESTRICT` on delete | Foreign key; unique index `shipments_quote_key` (one shipment per quote) |
| Created only from an accepted quote | The trigger refuses a quote whose request is not `ACCEPTED` (`quote_not_accepted`) | Trigger |
| Timestamps | `created_at`, `updated_at` (touch trigger) | Database |
| Current status | `shipment_status` enum: `BOOKED`, `IN_TRANSIT`, `AT_DESTINATION`, `DELIVERED`, `ON_HOLD`, `CANCELLED` | Enum |
| Validated transitions | `SHIPMENT_TRANSITIONS` (TypeScript) and `app_shipment_transition_allowed` (SQL) are the same table; a test keeps them identical. The staff form offers only allowed next statuses | Trigger `shipments_transition` |
| Status history and staff attribution | Every insert and change on `shipments` and `shipment_events` is written to the append-only `audit_log` with the acting user (`auth.uid()`), the time, and the changed columns | Audit triggers; `audit_log` refuses updates, deletes and truncation |
| Customer-facing progress | `shipment_events`: milestones (enum), location, EN/FR notes, `public` flag | RLS returns only public events to the owner |
| Isolation | RLS on `shipments`, `shipment_events`, `audit_log`; staff-only inserts and updates; customers see their own rows only | RLS; tests in `tests/db/rls.test.ts`, `tests/supabase/auth-and-rls.test.ts` |
| Public tracking | `public_track_shipment()` (rate-limited) returns status, route and public milestones only | Security-definer function |
| Notifications | `shipment_confirmed` on creation; `shipment_update` / `shipment_delivered` for each visible milestone; staff alert for On hold and Delayed | Outbox triggers |

## Implemented in Stage 5

| Change | Files | Why |
|---|---|---|
| **Staff shipment search, status filter and sort**: shipment or quote reference, customer name or email. This is the code already written for Stage 7, applied as is, plus the wildcard fix in the next row | `lib/services/shipments.ts` (`listShipmentsForStaff` filter), `app/[locale]/admin/(staff)/shipments/page.tsx`, two `admin.list` keys | Staff could only scroll the latest 200 shipments |
| **LIKE wildcards in staff searches matched everything**: Prisma passes `contains` values to `LIKE` unescaped, so a search for `%` or `_` matched every row. Now escaped, in the shipment search and the existing quote search | `lib/db/like.ts`, `lib/services/shipments.ts`, `lib/services/quote-requests.ts` | Correct search results. Not a data leak: only staff can search, and staff can see all rows anyway |
| **Shipment history for staff**: creation, every status change (from → to), ETA edits, milestones recorded, visibility changes, each with the time and the staff member (name from their account, "You", or "System"). Built from the audit log, so no history table is duplicated | `lib/domain/shipment-history.ts`, `getShipmentForStaff`, staff shipment page | Staff could not see who changed a shipment, or when |
| **Shipment details panel for staff**: customer name and email, quote request link, service, created, last updated, and the estimated arrival with its customer visibility | Staff shipment page | Association with the customer and original quote was not visible in one place |
| **Duplicate creation gives a clear answer**: a second attempt for the same request returns `shipment_exists` ("A shipment already exists for this request."). A concurrent second attempt is caught by the unique index and gets the same answer. Malformed request ids return `not_found` without a database call | `createShipmentForRequest`, `lib/db/errors.ts`, `app/[locale]/admin/actions.ts` | Previously a generic error |
| **Clear staff error messages** for a refused transition and for a quote that is not accepted | `app/[locale]/admin/actions.ts` | Previously "not allowed" / generic |
| **Customer shipment page**: a details panel with current status, estimated arrival **or "No estimated arrival date has been shared yet."**, booked date, last updated, and the quote request link | `app/[locale]/portal/shipments/[reference]/page.tsx` | Customers could not tell whether information was missing or simply not shared |
| EN and FR text for all of the above | `messages/en.json`, `messages/fr.json` (1,292 keys each) | Parity |
| Decisions SH-01 to SH-04 recorded | `docs/DECISIONS-REQUIRED.md` | See below |

Not added on purpose: new statuses or milestones (T-01), ETA wording or disclaimers (T-02), operational fields such as container or vessel numbers (SH-02), customer emails on status changes (SH-03), customer cancellation (SH-04), carrier tracking APIs, SMS or WhatsApp notifications.

## Shipment lifecycle

| From | Allowed next statuses |
|---|---|
| Booked | In transit, On hold, Cancelled |
| In transit | At destination, Delivered, On hold |
| At destination | Delivered, On hold |
| On hold | Booked, In transit, At destination, Cancelled |
| Delivered | none (final) |
| Cancelled | none (final) |

These are the existing rules (no new statuses). They are enforced by the database trigger and offered by the staff form.

## Status and milestones (option C, approved 2026-11-12)

The status is the operational state; milestones are the dated progress entries that customers see (when public). Public tracking shows a delivery date only from a public Delivered milestone, so the two must not drift apart.

When staff choose a new status in the form, the matching milestone is offered:

| New status | Milestone offered | Ticked by default | Visible to the customer by default |
|---|---|---|---|
| Delivered | Delivered | Yes | Yes |
| In transit | In transit | No | No |
| On hold | On hold | No | No |
| Booked, At destination, Cancelled | none (no matching code; no new codes, T-01) | — | — |

- **One transaction** (`updateShipment`, inside `withUser`): status and ETA update, then the milestone insert. If the transition is refused or the insert fails, nothing is saved, and no audit row or email is left behind.
- **No duplicates:** no second Delivered milestone ever; for In transit and On hold, none when the most recent milestone already has that code (a shipment can go on hold twice with progress in between). The form then says the milestone already existed.
- **Nothing automatic:** unticked means no milestone; an unchanged status records nothing even if the box is ticked.
- **Audit:** the status change and the milestone are two audit rows with the same staff member, shown in the shipment history in order.
- **Emails, unchanged:** a public milestone queues `shipment_update`, or `shipment_delivered` for Delivered, once (keyed by the milestone id). Status changes alone still send customers nothing (SH-03); On hold still alerts staff only.
- **No migration:** staff already may insert milestones (RLS and column grants); the existing triggers do the rest.

**Rule for staff:** to mark a shipment delivered, keep the Delivered box ticked. If the Delivered milestone was already recorded by hand, it is not added again; if that milestone was internal and the box asks for a visible one, the existing milestone is made visible instead (one delivery email).

**One Delivered milestone per shipment (release review, 2026-11-13):** the manual milestone form also refuses a second Delivered milestone ("This shipment already has a Delivered milestone…"). Both forms take the shipment's row lock before checking (the status form by updating the row, the manual form with `SELECT … FOR UPDATE`), so parallel requests cannot both add one. Verified with five parallel requests on the real local Postgres (`tests/supabase/delivery-concurrency.test.ts`): without the lock they produced three Delivered milestones and three delivery emails; with it, one and one. Other milestones (Delayed, On hold…) may still be recorded more than once by hand. No migration.

## Delivery email reliability

| Stage | What happens | Guarantee |
|---|---|---|
| Outbox row | A public Delivered milestone (inserted, or made visible) queues `shipment_delivered` in the same transaction, keyed `shipment_event:<milestone id>`; the unique index on `idempotency_key` ignores any re-queue | One row per milestone, and one Delivered milestone per shipment, so **one row per shipment**. If the business change rolls back, the row does too |
| Attempt | `processOutbox` claims due rows with `FOR UPDATE SKIP LOCKED` (no two workers take the same row), right after the request (`after()`) and in the daily cron | A row is sent by one worker at a time; a row stuck in SENDING is reclaimed after 10 minutes |
| Provider acceptance | Resend receives the row's idempotency key; status SENT records acceptance | A retry of the same row reuses the same key |
| Failure | FAILED with backoff (1, 5, 30, 120, 720 minutes), then DEAD after 5 attempts with one staff alert | The row is never lost or duplicated; it stays visible on the staff notifications page |
| Mailbox | Delivered, bounced or complained events arrive through the signed webhook | Not guaranteed by any sender |

**Not exactly-once delivery.** One queued email per shipment is guaranteed. The send itself is at-least-once with provider deduplication: if a provider call succeeds but the response is lost (timeout or crash), the retry carries the same idempotency key. Resend keeps those keys for 24 hours, so a retry more than 24 hours later could deliver a second copy. Within the window, Resend refuses a reused key whose payload differs (HTTP 409). The email is re-rendered for each attempt, so if staff edit the milestone between a failed attempt and its retry, the retry is refused, retried and finally marked DEAD with a staff alert: not lost silently, but not delivered automatically. On the Vercel Hobby plan retries run only after the next staff or customer action or at the daily cron, so a late retry is possible (Stage 8: more frequent retries). Inbox delivery depends on the recipient's provider and is only reported, never guaranteed.

## Permissions

| Action | Customer (owner) | Other customer | Anonymous | Staff | Admin |
|---|---|---|---|---|---|
| List own shipments | ✓ | — | — | — | — |
| Open a shipment | Own only (public milestones, ETA only when shared) | 404 | Login | All (all milestones, history, notes) | All |
| Search and filter shipments | — | — | — | ✓ | ✓ |
| Create from an accepted quote | — | — | — | ✓ (once per request) | ✓ |
| Change status or ETA | — | — | — | ✓ (allowed transitions) | ✓ |
| Record milestones, show or hide them | — | — | — | ✓ | ✓ |
| Report a problem on a shipment | ✓ | — | — | — | — |
| Public tracking by reference | Status, route, public milestones (rate-limited) | same | same | same | same |

Every server action checks the role again (`context()` in `app/[locale]/admin/actions.ts`); every service calls `assertStaff` or filters by `customerId`; RLS and column grants enforce the same rules in the database. Errors never reveal whether another customer's reference exists.

## Tests

| Suite | Added |
|---|---|
| Unit (`tests/unit/shipment-history.test.ts`) | Audit-row mapping for every history kind; unknown actions and unexpected values are ignored; lifecycle finality |
| Integration, PGlite (`tests/integration/shipment-management.test.ts`, 14 tests) | Creation from an accepted quote (owner, service, quote link, creator); refusal for unaccepted, unknown or malformed requests; duplicate prevention including two racing attempts and the database index; transitions (allowed, refused, final states) with history and staff attribution; ETA and visibility history; server-side input validation; search by shipment or quote reference, name, email and status; literal `%`, `_`, `\` in shipment and quote searches; customer list and detail isolation; ETA hidden until shared; internal milestones hidden; foreign, malformed and unknown references all return nothing; customers calling every staff service get `AuthorizationError` and nothing changes; RLS and column privileges (no customer insert, update, re-owning or audit access; staff cannot re-own, bypass transitions or delete) |
| Full stack (`tests/e2e-fullstack/shipments.spec.ts`, 5 tests) | Real browser, production build, local Supabase: customer list and detail in EN and FR with "not shared yet"; no staff controls for customers; another customer, a signed-out visitor and malformed references get 404 or the login page; staff search, filter, details, history, status change through the form (only allowed options), FR history; the customer sees the update; phone layout and axe checks on customer and staff shipment pages |

The full-stack fixture (`createLocalShipment` in `tests/e2e-fullstack/local-db.ts`) runs only against a local database and creates its data through the same RLS roles and triggers as the application.

**Option C tests:** unit (mapping, defaults, duplicate rule); integration (7 tests: status and public Delivered milestone in one transaction with history and exactly one delivery email; no second Delivered milestone or email; On hold repeat rule; nothing recorded when unticked, unchanged or unmapped, including Cancelled; refused transition saves nothing; forced milestone failure rolls back the status and leaves no audit row; customers refused, bad input refused); full stack (defaults in the form, no customer email for an ordinary status change, Delivered recorded with the status and emailed once, the customer and public tracking show it).

## Production release (when approved)

1. Fast-forward `master` to the Stage 5 commit and push; Vercel builds it.
2. **No migration**: the build log must say "No pending migrations to apply".
3. No environment variable, Supabase setting or feature flag changes.
4. Read-only smoke checks: public pages; `/en/admin/shipments` and `/en/portal/shipments` redirect signed-out visitors to the login page; malformed shipment references return 404.
5. A real shipment can only be checked as part of the separately approved production acceptance test (it needs an accepted quotation).
6. Rollback: promote the Stage 4 deployment `8qdHgyrXJXNpLNhW6PJ5EETPWyka` (no data changes to undo).
7. Stage 7, when later rebased onto Stage 5, finds its shipment search page and message keys already present (identical). One small conflict remains in `listShipmentsForStaff`: keep the Stage 5 version, which adds the wildcard escaping.
