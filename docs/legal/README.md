# Legal page drafts: status and review pack

> **None of these documents is approved.** They are drafts prepared by the developer for review by the owner and a qualified lawyer. They are not legal advice, and they make no claim of legal compliance. Nothing here is published on the website except the cookie inventory (`/cookies`) and the existing privacy summary (`/privacy`), both of which carry a visible "draft" notice.

## How the drafts are written

- **Facts only.** Each draft states only what is verified in the code, the infrastructure or the owner's written answers. Examples: the business name, the addresses, the routes, the departure windows, the services, that quotes are staff-priced in EUR or XAF, and the processors actually configured.
- **Markers for decisions.** Anything that needs a business or legal decision is marked **[OWNER/LEGAL: ID — question]**. No guarantee, insurance, refund period, liability limit, customs charge, VAT treatment, payment method or registration detail has been invented.
- **Both languages in each file.** Each file contains the English text, then the French text. The French text is a translation for review, not a separately drafted legal text. The lawyer should confirm which language prevails.
- **The law named must be checked.** The legal frameworks named are those a reviewer is likely to check: the GDPR, the Irish Data Protection Act 2018, the Irish ePrivacy Regulations (S.I. 336/2011), the Irish Consumer Rights Act 2022, Cameroonian law on personal data, electronic commerce and cybersecurity, CEMAC customs rules, and the international carriage conventions. **Counsel must confirm whether and how each one applies.**

## Status

| # | Draft | File | Published? | Blocking decisions |
| --- | --- | --- | --- | --- |
| 1 | Privacy notice | [privacy-notice.md](privacy-notice.md) | A short factual summary is live at `/privacy` with a draft notice | B-02, L-02, L-03 |
| 2 | Cookie policy | [cookie-policy.md](cookie-policy.md) | Inventory live at `/cookies` with a draft notice | L-04 (wording review) |
| 3 | Terms and conditions | [terms-and-conditions.md](terms-and-conditions.md) | No (`/terms` returns 404 until L-01) | B-02, L-01, P-03, P-05 |
| 4 | Shipping policy | [shipping-policy.md](shipping-policy.md) | No | S-01, S-02, T-02, L-05 |
| 5 | Payment, refund and cancellation | [payment-refund-cancellation.md](payment-refund-cancellation.md) | No | P-05, P-06, L-06 |
| 6 | Customs and prohibited goods | [customs-prohibited-goods.md](customs-prohibited-goods.md) | No | S-03, P-04 |
| 7 | Claims and complaints | [claims-complaints.md](claims-complaints.md) | No | L-05, L-07 |

## Links on the website

| Where | Today | After approval |
| --- | --- | --- |
| Footer, "Company" column | Privacy, Cookies, Cookie preferences | Add Terms (automatic when `ownerConfig.legal.termsApproved` is true) and the other approved pages |
| Quote form, final step | Privacy acknowledgement checkbox, linked | Add "I accept the Terms and conditions" once L-01 is approved: a separate checkbox, never pre-ticked |
| Contact form | Privacy acknowledgement, linked | No change |
| Quotation acceptance page | Shows the quotation's own inclusions and exclusions | Link the Terms and the Payment/Cancellation policy at the point of acceptance |
| Transactional emails | Footer with contact details | Link Privacy and Terms once published |

## Decision IDs introduced by these drafts

These are added to `docs/DECISIONS-REQUIRED.md`.

- **L-04:** approval of the cookie policy wording.
- **L-05:** liability, insurance and the carriage terms that apply (Montreal Convention for air, Hague-Visby for sea, others).
- **L-06:** the cancellation right for distance contracts (Consumer Rights Act 2022) and its exceptions.
- **L-07:** claim deadlines, the complaint-handling process and any dispute-resolution body.
- **P-05:** accepted payment methods, deposit, and when payment is due.
- **P-06:** refund rules and timelines.
