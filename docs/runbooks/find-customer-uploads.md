# Runbook: finding customer uploads when an email alert is missing

Status: **applies once document uploads are switched on** (`ENABLE_DOCUMENT_UPLOADS`, after L-03). Uploads are off in production today.

## Why this exists

When a customer uploads a document, the site normally emails staff a "New document on QR…/ML…" alert. The alert is queued just after the document is saved. If queueing fails, **the document is still saved** and stays on its record; only the email is missing. Every upload is also written to the audit log by the database, so staff can always find it there, whether or not an email arrived.

Signs that an alert went missing:

- the customer says they sent a document and nobody received an email;
- the notifications page shows no `staff_document_uploaded` email for that time;
- the server log contains `[documents] staff upload alert not queued for document <id>` (operators: Vercel logs). The line gives only the document id: no file name, content or customer details.

## Find the uploads (staff area, any staff member)

1. Open **Staff area → Audit log** (`/en/admin/audit`, or `/fr/admin/audit` in French).
2. Set **Record type** to **Document** (FR: *Document*).
3. Set **Action** to **Created** (FR: *Créé*).
4. Optional: set **From** and **To** to the days in question (Irish dates). If you know the quote or shipment reference, type it in **Reference** (for example `QRABC234` or `MLABCDEFGH23`).
5. Select **Apply filters** (FR: *Appliquer les filtres*).
6. Each row is one upload. The **Actor** column (FR: *Auteur*) shows who uploaded it (the customer's name, a staff name, or "System"). The **Record** column links to the quote request or shipment.
7. Open the link. In the record's **Documents** section, the file is listed with its type, size, date and "Uploaded by the customer". Use **Download** (a private link that is valid for 60 seconds).

The audit log shows **which** document was created, never its contents or old and new values. Downloads always go through the document's record page, where access is checked again.

## What not to do

- Do not ask the customer to upload again just because the email is missing: check the audit log first.
- Do not re-send or recreate the alert by hand; there is no manual retry (owner decision D4), and none is needed once the document is found.
- Do not copy document names or contents into tickets or chats; use the reference.
