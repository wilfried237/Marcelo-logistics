# Stage 6: supporting features

_2026-11-13, branch `feat/stage-6-supporting-features`, built on the production commit `ef12517` (Stage 5). Not merged, pushed or deployed. **No database migration. No production setting, environment variable, feature switch, Supabase or Vercel setting, or data was changed.** Stage 7 was not touched._

Scope: document handling, notifications, audit logs and scheduled jobs, as approved after the Stage 6 discovery report. Working functionality from Stages 1 to 5 was reused, not rebuilt.

## Owner decisions applied

| ID | Decision | Implementation |
|---|---|---|
| D1 | Maximum 4 MB per file | `lib/config/upload-limits.ts`; Server Action body limit raised to fit; form, action and service all enforce it |
| D2 | Staff upload form, behind the existing switch | `staffUploadDocumentAction` and `StaffUploadForm`; refused on the server while `ENABLE_DOCUMENT_UPLOADS` is off |
| D3 | Audit shows changed field names only | Values are dropped in `lib/services/audit.ts` and never reach the page or its HTML |
| D4 | No manual retry of DEAD emails | The notification views are read-only; a test checks the code holds no write or send path |

## What changed

| Step | Commit subject | What it does |
|---|---|---|
| 1 | `fix(documents): enforce supported upload size` | Uploads used a Server Action whose body limit is 1 MB by default, so files over about 1 MB failed despite the advertised 10 MB. The limit is now **4 MiB (4,194,304 bytes)** per file; `experimental.serverActions.bodySizeLimit` is **4,456,448 bytes** (file plus 256 KiB for multipart framing), below Vercel's 4.5 MB request limit even read as 4,500,000 bytes. The form clears an oversized file before sending it; an empty submission now says "Choose a file to upload." The private bucket's own limit (10 MB) is a production storage setting and was not changed |
| 2 | `feat(documents): add staff and customer views` | Documents section on the customer quote and shipment pages (own documents only, "added by you / by Marchelo Logistics") and on the staff quote and shipment pages (with the uploader: the customer, or the staff member's name). Downloads only through `/api/documents/[id]` (access re-checked, 60-second signed URL). The uploader column is not granted to API roles; it is read with the server connection only for documents the access rules already returned |
| 3 | `feat(documents): add staff upload` | Staff upload on the staff quote and shipment pages, shown only while uploads are available. The action re-checks the role and the switch, then uses the existing document service (content type check, record must exist, private server-generated key, uploader recorded and audited) |
| 4 | `feat(audit): improve staff audit search and filtering` | Filters (record type, action, staff member or "System", Irish-time date range), search by QR / ML / CE reference (the record and its dependants), 50 per page, staff names, links to the record (user management for admins only), changed field names only. Append-only design, triggers and staff-only RLS unchanged |
| 5 | `feat(notifications): improve notification history` | Filters (status, template, audience), "About" links to the quote request, shipment or enquiry, pagination, readable EN/FR status labels, a shortcut to DEAD emails, and email history on the staff shipment page. Recipients, content and payloads are never selected |
| 6 | `feat(jobs): add job health visibility` | From existing `job_runs` records when the page loads: a run unfinished after 15 minutes is flagged; no success in 36 hours gives a warning; a failed last run is a problem; red or amber banner; per-job table; recent runs. No new cron, no `pg_cron`, no paid service, no write. Also: notification reads moved under RLS, and the scrolling tables became focusable regions (accessibility) |
| 7 | `feat(notifications): alert staff on customer uploads` | One `staff_document_uploaded` staff email per customer upload (outbox key per document), with reference, customer name, file type and size and a link, never the file name or content. EN and FR texts; sent in English like the other staff alerts. Behind the upload switch, because uploads only happen while it is on |
| 8 | `docs(stage-6): document implementation and decisions` | This record and `DECISIONS-REQUIRED.md` |

## Measured upload size (real browser, local stack)

| File | Request body | Overhead | Server Action limit | Vercel limit |
|---|---|---|---|---|
| 4,194,304 bytes (exactly 4 MiB, PDF) | **4,195,380 bytes** | 1,076 bytes | 4,456,448 bytes | 4,500,000 bytes (conservative) |

The file was stored and downloaded intact. A file one byte over 4 MiB is cleared by the form; placed without the form's check, it is refused by the server ("The file is larger than 4 MB."). A 5 MB body is refused by Next.js itself ("Body exceeded 4456448 limit"); Next.js 16 answers **500**, not 413, for an over-limit Server Action. On Vercel, bodies over 4.5 MB are refused by the platform before the function runs. The Vercel limit itself cannot be exercised locally; the margin is 43,552 bytes under the stricter reading.

## Tests

| Suite | Stage 5 baseline | Stage 6 |
|---|---|---|
| Unit and integration (Vitest, PGlite) | 286 passed | **320 passed** |
| Browser (public site) | 178 passed, 4 skipped | 178 passed, 4 skipped |
| Local Supabase | 25 passed, 3 skipped | 25 passed, 3 skipped |
| Full stack (production build, local Supabase) | 23 passed, 1 skipped | **36 passed**, 1 skipped |
| Typecheck, full lint, EN/FR parity, security scan, `npm run build` | pass | pass (1,396 keys each; 192 files scanned) |

Skipped tests are variants for the other device (browser) and for open registration (registration is closed). No pre-existing failures occurred in these runs. The tracking rate-limit test that failed once under load in Stage 5 (a fixed one-minute window) passed.

New tests: `tests/unit/upload-limits.test.ts`, `tests/unit/staff-upload-action.test.ts`, `tests/unit/job-health.test.ts`, `tests/integration/audit.test.ts`, `tests/integration/notifications.test.ts`, additions to `tests/integration/documents.test.ts`, `jobs.test.ts` and `email-previews.test.ts`, `tests/e2e-fullstack/documents.spec.ts` and `tests/e2e-fullstack/staff-supporting.spec.ts`. Uploads are switched on only in the local full-stack test environment (`playwright.fullstack.config.ts`).

## Limitations and deferred work

- **Uploads stay off in production** (`ENABLE_DOCUMENT_UPLOADS`), so Steps 1 to 3 and 7 are inactive there until L-03 is answered and the switch is approved separately.
- **No deletion** of documents by customers or staff, no retention periods, no automatic deletion (L-03); the retention job remains a dry run.
- **No audit export, no auditing of downloads** (a download audit would need a migration).
- **No manual retry** of DEAD emails (D4). A DEAD email stays visible with its error.
- **The upload alert is queued just after the upload commits**, not in the same transaction (the insert runs under the customer's RLS; the outbox function needs the server connection). If queueing fails, the document is kept and the failure is logged; the staff still see the document on the record.
- **Immediate email sending takes the 10 oldest due emails.** If a backlog of unsent emails exists, a new alert waits for the next action or the daily job (existing outbox behaviour; on the Hobby plan the job is daily).
- **Job health is shown, not pushed:** it is calculated when a staff member opens the notifications page. Nobody is emailed if the cron stops entirely (that needs a scheduler outside the app; not in scope).
- Next.js answers 500 rather than 413 for an over-limit Server Action body; only reachable by bypassing the form's size check.

## Production release (separate approval)

1. Review, then fast-forward `master` to the Stage 6 head and push; Vercel builds it.
2. **No migration**: the build log must say "No pending migrations to apply".
3. No environment variable, Supabase setting or feature switch changes. `ENABLE_DOCUMENT_UPLOADS` stays off.
4. Read-only smoke checks: public pages EN/FR; signed-out visitors are sent to login from the staff audit, notifications and shipment pages; robots.txt still blocks indexing; registration closed.
5. Rollback: promote the Stage 5 deployment `2Kh4XQuBvFgdvCCBTZjn15TBDwLH` (no data to undo).
