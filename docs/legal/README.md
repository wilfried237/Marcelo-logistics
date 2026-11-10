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
| 4 | Shipping policy | [shipping-policy.md](shipping-policy.md) | No | S-02, T-02, L-05 |
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

## Stage 3 client-supplied terms (2026-11-10)

The client supplied the business policies below. The **operational** ones are published as customer information in the shipping guide and FAQ, with the statement that they do not affect statutory rights. The **contractual** ones are recorded here for the lawyer and are **not published**.

| Client statement | Status on the website | Decision |
| --- | --- | --- |
| Payment by bank transfer or Revolut; 20% deposit for sea groupage; express paid in full before dispatch; balance before departure; XAF only for Cameroon → Ireland | Published (guide, FAQ) | P-05 answered; P-10 open |
| Listed prices include applicable VAT | Published as information (price list, guide, FAQ) | L-11: review before contractual use; VAT number missing (B-02) |
| Customs clearance included for parcels and personal effects; vehicles excluded | Published as information | L-11 |
| Cancellation possible subject to conditions; refund only before the shipment leaves the premises; delays notified by telephone, WhatsApp or email | Published, with “does not affect your statutory rights” | P-06 (conditions, method, timeline still open); L-06 |
| Lost or damaged goods: a shipping voucher, not a cash refund; maximum €400 per shipment | **Not published.** The guide says the policy is being finalised | L-10: check against consumer law (Consumer Rights Act 2022) and the carriage conventions (L-05) |
| €150 “administrative fine” for prohibited goods | **Not published.** It must never be presented as a statutory or government fine | L-09 |
| BIFA, UKWA and RHA standard trading conditions (via a Kuehne+Nagel link) | **Not referenced or copied.** No membership claimed | L-08: the BIFA 2025 conditions are for current BIFA members only |
| Data controller: the person named by the client (held privately) | **Not published** | L-02: the controller is normally the company, with a named contact |

**Drafts to update after the answers:**
- `payment-refund-cancellation.md`: payment methods, deposit, and the refund-before-departure rule (P-05, P-06).
- `customs-prohibited-goods.md`: the official prohibited list (S-03) and the customs inclusions (P-04).
- `claims-complaints.md`: the voucher and the €400 limit, only if approved (L-10).
