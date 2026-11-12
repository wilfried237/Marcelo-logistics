# Decisions Required from the Owner

_Last updated: 2026-11-13 (Stage 6 decisions D1 to D4 answered and remaining open items: see [section 10](#10-stage-6-supporting-features-2026-11-13); Stage 5: implementation recommendations approved for T-01, T-02 and SH-01 to SH-04, business and legal confirmation still open: see [section 4](#4-delivery-estimates-and-shipment-tracking); Stage 3 price list and customer information: see [section 9](#9-stage-3-client-information-2026-11-10); legal drafts: [docs/legal/](./legal/README.md); completion audit: [PROJECT-COMPLETION-AUDIT.md](./PROJECT-COMPLETION-AUDIT.md)) · This is the single consolidated list of open **business** decisions._

**How to answer:** write your answer on the `Answer:` line under each decision (or reply by email quoting the ID). Answers already recorded here are preserved. Development continues on everything that does not depend on an answer.

**How unresolved items are handled in the code:** every unresolved fact carries the marker `{{NEEDS_OWNER}}` (in `config/owner.ts` or `messages/*.json`). Visitors never see the marker; a neutral fallback or nothing is shown instead. The **launch build** (`RELEASE_BUILD=true`) **fails** while any marker remains; Vercel preview and pre-launch production builds only list them as warnings (`npm run check:owner` lists them).

Technical decisions (stack, database, auth, hosting, email provider, testing) are settled by the project directive and documented in [ARCHITECTURE.md](./ARCHITECTURE.md). They are not repeated here.

### Quick index (★ = blocks a release; ◆ = blocks enabling a feature)

| ID | Decision | Blocks |
|---|---|---|
| B-01 ✓ | Official business name: **Marchelo Logistics** (answered 2026-11-03) | — |
| B-02 ★ | Legal entity, registration and VAT details (**partly answered 2026-11-10**: names and addresses; registration and VAT numbers still missing) | Release (legal pages, footer) |
| S-01 ✓ | Which services are offered now | **Answered 2026-11-09: all nine services confirmed** |
| S-02 | Routes and destination cities (routes and monthly windows answered 2026-11-03; cities open) | Quote form options |
| S-03 ✓ | Prohibited and restricted items | **Answered 2026-11-10** (list published; see L-09 for the proposed fee) |
| S-04 | Quote form for the three new service categories (database change) | Online quotes for customs, warehousing, e-commerce |
| P-01 ✓ | Who reviews quotes | **Answered 2026-11-09: the owner reviews every request and replies personally** (response-time wording still open) |
| P-02 | Information required per service | Quote form fields |
| P-03 | Currencies, VAT presentation, quote validity | Staff quote form defaults |
| P-04 ✓ | Customs duties: included or not | **Answered 2026-11-10** (included for parcels and personal effects; vehicles quoted separately; see L-11) |
| T-01 | Tracking milestones shown to customers (**implementation recommendation approved 2026-11-12**: keep the 12 codes; wording to confirm) | Tracking page labels |
| T-02 | Delivery-estimate policy (**implementation recommendation approved 2026-11-12**: optional, hidden unless shared; policy and disclaimer open) | Whether ETAs are shown |
| SH-01 | One shipment per accepted request, or split consignments (**implementation recommendation approved 2026-11-12**: one per accepted quote) | Shipment creation |
| SH-02 | Operational fields to record per shipment (**implementation recommendation approved 2026-11-12**: none until confirmed) | Shipment details, customer view |
| SH-03 | Customer emails for status changes (**implementation recommendation approved 2026-11-12**: none; public milestones instead; cancellation message open) | Shipment notifications |
| SH-04 | Who may cancel a booked shipment, and what the customer is told (**implementation recommendation approved 2026-11-12**: staff only; refund terms open, P-06, L-06, L-10) | Shipment cancellation |
| C-01 ✓ | Verify contact details | **Answered 2026-11-06; WhatsApp and opening hours answered 2026-11-09** |
| C-02 ◆ | Sender email domain and staff notification inbox | Enabling email |
| C-03 | Customer account onboarding: open registration or invitation only | **Answered 2026-11-04: open registration** |
| L-01 ★ | Terms and conditions of carriage | Release (terms page hidden) |
| L-02 ★ | Privacy notice: controller identity and contact | Release |
| L-03 ◆ | Document and data retention periods | Enabling uploads; automatic deletion |
| L-04 ★ | Cookie policy wording (the inventory is factual and live as a draft) | Release |
| L-05 | Liability, insurance and carriage regime | Terms, claims policy |
| L-06 | Cancellation right for distance contracts | Payment and cancellation policy |
| L-07 | Claim deadlines, complaint process, dispute resolution | Claims policy |
| P-05 ✓ | Payment methods, deposit, due date | **Answered 2026-11-10** (published in the shipping guide and FAQ; see P-10) |
| P-06 | Refund rules and timelines (partly answered 2026-11-10; see L-10) | Payment policy |
| P-07 | 55-inch televisions fall in two price bands | Price list, quote guidance |
| P-08 | No price for parcels of 15–20 kg or over 50 kg | Price list |
| P-09 | Storage charge stated in XAF; which premises | Price list, guide |
| P-10 | Enforce “XAF only for Cameroon → Ireland” in the staff quote form? | Staff quote form |
| S-05 | Quote-form grouping of furniture and cartons | Quote form guidance |
| S-06 | Drop-off (collection point) addresses | Guide, service pages |
| S-07 | Which services the collection, delivery and storage rules apply to | Service pages |
| C-04 | Role of the additional Irish number | Contact details |
| L-08 ★ | Standard trading conditions (BIFA/UKWA/RHA) | Terms |
| L-09 | Proposed €150 fee for prohibited goods | Terms, guide |
| L-10 ★ | Voucher instead of cash refund, €400 compensation limit | Terms, claims policy |
| L-11 | VAT and customs statements as contractual assurances | Terms, price list |
| A-01 ✓ | Logo in use on every page (2026-11-04); artwork wording vs name to confirm | — |
| A-02 | Photographs | Visual quality only |
| R-01 ◆ | Vercel and Supabase account ownership and EU region | Preview deployment, database |
| R-02 ✓ | Migrations applied automatically on production deployments (approved 2026-11-03) | — |
| R-03 ★ | Launch approval and relationship to the live WordPress site | Production launch |
| D1 ✓ | Document upload size | **Answered 2026-11-13: 4 MB per file** (Stage 6) |
| D2 ✓ | Staff upload form | **Answered 2026-11-13: yes, behind `ENABLE_DOCUMENT_UPLOADS`** (Stage 6) |
| D3 ✓ | Audit detail shown to staff | **Answered 2026-11-13: changed field names only, never values** (Stage 6) |
| D4 ✓ | Manual retry of DEAD emails | **Answered 2026-11-13: no** (Stage 6) |

---

## 1. Business identity and branding

### B-01 ★ Official business name
- **Decision needed:** the exact name customers should see, in EN and FR.
- **Why it matters:** it appears in the header, emails, legal pages and metadata. The material shows **conflicting evidence**: the project brief says "Marcel Logistics"; the live site `marchelo-logistics.com` and the logo file say "Marchelo Logistics" ("MARCHELO LOGISTICS CARGO" on the logo); the old code also had "Machelo".
- **Recommended:** confirm one spelling and say whether "Cargo" is part of it.
- **Options:** "Marcel Logistics" · "Marchelo Logistics" · "Marchelo Logistics Cargo" · other.
- **If delayed:** the site shows the neutral tagline "Logistics between Ireland and Cameroon" instead of a name; the launch build (`RELEASE_BUILD=true`) fails.
- **Affected:** `messages/en.json` and `messages/fr.json` → `brand.name`; email templates; footer.
- **Development can continue:** yes.
- **Answer:** **Marchelo Logistics**, without “Cargo”. Given in the developer’s instruction of 2026-11-03 and applied to `brand.name` (EN and FR). Owner to confirm in writing if this did not come from them directly.

### B-02 ★ Legal entity details
- **Decision needed:** registered company or sole-trader name, registration number (CRO or other), registered address, VAT number (if registered).
- **Why it matters:** needed for the footer, privacy notice, terms and invoices. Irish and EU rules require identifying the trader online.
- **Recommended:** provide them as registered.
- **If delayed:** the footer shows "Business and legal details will be published once confirmed"; the launch build (`RELEASE_BUILD=true`) fails via L-01/L-02.
- **Affected:** footer, `/privacy`, `/terms`.
- **Development can continue:** yes.
- **Answer (partial, client, 2026-11-10):** legal entity **MARCHELO LOGISTICS CARGO LTD**, trading name **MARCHELO LOGISTICS DISTRIBUTION**; Ireland address 12 Griffeen Glen Chase, Lucan, Co. Dublin, Ireland; Cameroon address Ndogsimbi, Douala, face Station-Service Gulfil, Cameroun. Applied in `config/owner.ts` (`company`, `locations`), the About page and the footer. **Still open:** the company registration number and the VAT number (the client says a VAT number exists but did not supply it). Both stay `null`; never invent them.

## 2. Services, destinations and logistics operations

### S-01 ★ Services currently offered
- **Partly answered (client, 2026-11-06):** the client supplied six service categories, recorded as confirmed: air freight and express parcels, sea freight (FCL and LCL), vehicle shipping, warehousing and distribution, customs clearance, e-commerce and online shopping. The first three extend existing categories (renamed and re-described); the last three are new. **Still open:** barrels and boxes, parcels and personal effects, commercial cargo are kept on the site with "Availability on request" until the client confirms them.
- **Decision needed:** for each category, say *offered now*, *coming soon* or *not offered*: parcels and personal effects · barrels and boxes · air freight · sea freight (shared or full container) · vehicle transport · commercial cargo.
- **Why it matters:** listing a service creates customer expectations and possible liability.
- **Recommended:** confirm only what is operational today.
- **If delayed:** all six categories are shown with "Availability to be confirmed" and remain selectable in the quote form (staff can decline).
- **Affected:** `config/owner.ts` → `operations.confirmedServices`; `/services`; quote form.
- **Development can continue:** yes.
- **Answer (owner, 2026-11-09):** parcels, barrels and commercial cargo all remain available. All nine services are now confirmed in `config/owner.ts` (`operations.confirmedServices`); no service shows "Availability on request" any more. These three already have quote-form service codes (`parcels`, `barrels`, `commercial_cargo`), so **no database migration is needed for them**. S-04 (customs clearance, warehousing, e-commerce in the quote form) remains a separate, unapplied proposal.

### S-02 Routes and destination cities
- **Decision needed:** origin countries (Ireland only? Northern Ireland or UK?), destination countries (Cameroon only, or other approved African countries — which?), and destination cities or collection points in Cameroon.
- **Why it matters:** these drive the quote form options and validation.
- **Recommended:** start with Ireland → Cameroon and list the cities served.
- **If delayed:** the form offers Ireland → Cameroon with a free-text destination city.
- **Affected:** `config/owner.ts` → `operations.routes`.
- **Development can continue:** yes.
- **Answer (partial, 2026-11-03, client message relayed by the developer):** « On fait déjà express shipping tous les mois : Irlande → Cameroun entre le 10 et le 15 de chaque mois, Cameroun → Irlande entre le 20 et le 25 de chaque mois. » Applied: both directions are offered online, with these monthly departure windows shown on the home, services, how-it-works and FAQ pages. **Still open:** destination cities or collection points; whether “express” means air or sea freight, and which services it covers. **Until answered (2026-11-10):** the service pages make no claim about which services use the monthly departures; the schedule appears only on the general pages (home, services overview, shipping guide, FAQ, how it works).

### S-03 Prohibited and restricted items
- **Decision needed:** the list of items you will not carry, or carry only with conditions.
- **Why it matters:** customers need it before packing barrels and boxes; it reduces customs problems.
- **If delayed:** no binding list is published. The shipping guide (`/shipping-guide`) shows general categories under “Ask us before packing these” (flammables and gas, loose batteries, weapons, medicines and chemicals, perishable food, cash and valuables) and says the final list is confirmed in the quote.
- **Affected:** FAQ, shipping guide (`prohibited.*` in `messages/*.json`), service pages.
- **Development can continue:** yes.
- **Answer (client, 2026-11-10):** twelve prohibited categories (military equipment; firearms; explosives; hazardous chemicals and flammables; undeclared or damaged batteries and non-compliant devices; narcotics and unprescribed medicines; perishables and non-compliant meat or fish; live animals and protected species; cash, undeclared gold, precious stones and travellers’ cheques; counterfeit goods and falsified documents; waste and toxic products; anything prohibited by Cameroonian or EU rules). Published at `/shipping-guide#prohibited` with a note that the list does not replace current regulations. The proposed €150 fee is **not** published (L-09).

### S-04 Online quotes for customs clearance, warehousing and e-commerce
- **Decision needed:** approve the database change that lets customers choose the three new categories in the quote form.
- **Today:** they are listed on the home and services pages with "Ask us about this service" (contact form). The quote form offers the six existing categories; staff see the new names for the renamed ones automatically.
- **Change proposed:** a migration adding `customs_clearance`, `warehousing` and `ecommerce` to the PostgreSQL enum `service_code` (`ALTER TYPE … ADD VALUE IF NOT EXISTS`, additive, no table rewrite, existing quote requests untouched), the same values in `prisma/schema.prisma` and `SERVICE_CODES`, `quoteCode` set in `SERVICE_OFFERINGS`, and tests. Enum values cannot be removed later; the previous app version keeps working (it never writes them). Applied by the next production deployment like the earlier migrations.
- **Full proposal (2026-11-09):** [docs/proposals/S-04-service-codes.md](./proposals/S-04-service-codes.md): migration SQL, compatibility, application changes and the questions for each service. Not created and not applied.
- **Also to decide:** which questions the form should ask for these services (they are not route-and-items shipments in the same way), or whether they stay contact-only.
- **Development can continue:** yes.
- **Answer:**

## 3. Pricing and quotation rules

> Settled by the directive: **no automatic prices**. Staff enter every quote manually.

### P-01 ◆ Quote handling and response-time wording
- **Decision needed:** (a) who receives and reviews quote requests (a staff email address for notifications); (b) whether the site may state a response time and, if so, which one (e.g. "within 2 working days").
- **Why it matters:** customers need to know what happens next; a stated time is a commitment.
- **Recommended:** a shared inbox; no time promise until it is reliably met.
- **If delayed:** the confirmation says "Our team will review your request and contact you", with no time stated. Quote submission stays disabled until a reviewer exists (C-02).
- **Affected:** `STAFF_NOTIFICATION_EMAIL`, confirmation copy, acknowledgement email.
- **Development can continue:** yes.
- **Answer (owner, 2026-11-09):** (a) the project owner reviews every incoming quote request and replies to customers personally; there is no separate customer-service team. Staff alerts (`staff_new_request`, customer messages, acceptances, declines) go to `STAFF_NOTIFICATION_EMAIL`, which must be set in Vercel to the owner's notification address (a production setting, not stored in the repository). Customer-facing wording now says "we review every request personally" rather than "our team". (b) **Still open:** whether to state a response time; until then none is stated.
- **Remaining before quote submission can be enabled:** the first administrator account (the owner), `STAFF_NOTIFICATION_EMAIL` set to the owner's address, transactional email activated (`quoteSubmissionStatus` requires it), then `ENABLE_QUOTE_SUBMISSION=true`. All are production changes awaiting approval.

### P-02 Information required per service
- **Decision needed:** what you need in order to price each service, for example: number and size of barrels; box dimensions; vehicle make, model, year and whether it runs; container size; commercial goods description and value.
- **Why it matters:** with complete information you can price without back-and-forth.
- **If delayed:** a sensible default set is used (item list with quantity, approximate weight and dimensions; vehicle make, model and year; notes) and can be changed later.
- **Affected:** `lib/domain/quote-schema.ts`, quote form.
- **Development can continue:** yes.
- **Answer:**

### P-03 Currencies, VAT presentation and quote validity
- **Implementation note (2026-11-04):** staff now build quotes line by line (charges, discounts). Tax lines are switched off until approved rates are listed in `config/owner.ts` → `pricing.taxRatesBp` (e.g. `[2300]` for 23 %).
- **Decision needed:** currencies you quote in (EUR, XAF, both); whether quotes are shown including or excluding VAT; default validity period (e.g. 14 days).
- **If delayed:** staff may choose EUR or XAF per quote; validity is entered per quote; the VAT treatment is written in the inclusions/exclusions text.
- **Affected:** staff quote form, quote display.
- **Development can continue:** yes.
- **Answer:**

### P-05 Payment methods and timing
- **Decision needed:** which payment methods you accept (only those actually used), whether a deposit is taken, when payment is due, and whether a EUR quote can be paid in XAF. The website takes no online payments.
- **Draft:** [docs/legal/payment-refund-cancellation.md](./legal/payment-refund-cancellation.md).
- **Answer (client, 2026-11-10):** bank transfer and Revolut; sea groupage 20% deposit at booking; express freight paid in full before dispatch; any balance paid before departure; XAF accepted only for shipments from Cameroon to Ireland. Published in the shipping guide and FAQ. The website still takes no payments.

### P-06 Refunds
- **Decision needed:** when refunds are due (for example cancellation before departure, or a service not performed), how they are calculated, the method and the timeline.
- **Answer (partial, client, 2026-11-10):** cancellation is possible subject to conditions; a refund only if the shipment has not left the premises; delays are communicated by telephone, WhatsApp or email. Published with “These are our own business policies. They do not affect your statutory rights.” **Still open:** the conditions, how a refund is calculated, method and timeline; and the lost/damaged policy (L-10).

### P-04 Customs duties and destination charges
- **Decision needed:** are Cameroon customs duties and taxes ever included in your quote, optional, or always paid by the recipient?
- **If delayed:** staff state it per quote in inclusions/exclusions.
- **Development can continue:** yes.
- **Answer (client, 2026-11-10):** customs clearance is included for parcels and personal effects; vehicle customs clearance is excluded and quoted separately; customs clearance services are available in Cameroon (no separate price supplied). Listed prices include applicable VAT. Published as customer information; see L-11 before using these statements as contractual terms.

## 4. Delivery estimates and shipment tracking

> **How to read the Stage 5 entries below (T-01, T-02, SH-01 to SH-04).** On 2026-11-12 the owner approved an **implementation recommendation** for each: the behaviour the website follows for now. This is **not** the final business or legal confirmation. The `Answer:` line stays open until the business (and, where marked, legal review) confirms or changes it. Nothing here sets a refund, compensation, delivery-time or liability policy.

### T-01 Tracking milestones shown to customers
- **Decision needed:** confirm or adjust the default stages: Booked → Received at depot → Departed origin → In transit → Arrived at destination port → In customs → Customs cleared → Ready for collection → Out for delivery → Delivered (plus "Delayed" and "On hold").
- **If delayed:** the defaults are used; staff choose which events are public.
- **Affected:** `MILESTONE_CODES` in `lib/domain/enums.ts` (the database enum must match), translations.
- **Development can continue:** yes.
- **Approved implementation recommendation (2026-11-12):** keep the existing 12 milestone codes and their current EN/FR wording. No code is added (for example, there is no "Cancelled" milestone).
- **Still unresolved (business):** confirmation of the wording customers see. Adding or removing a milestone needs a database migration.
- **Answer:**

### T-02 Delivery-estimate policy
- **Decision needed:** may staff show an estimated arrival range to customers? Should a disclaimer accompany it?
- **If delayed:** ETAs can be recorded by staff but are **only** shown when staff tick "show to customer"; no default estimates exist.
- **Development can continue:** yes.
- **Approved implementation recommendation (2026-11-12):** the ETA stays optional and hidden unless staff explicitly share it for that shipment. When it is not shared, customers see "No estimated arrival date has been shared yet."
- **Still unresolved (business and legal):** whether ETAs may be shown at all, and any disclaimer wording. No disclaimer has been written, and no delivery time is promised anywhere.
- **Answer:**

### SH-01 One shipment per accepted request (Stage 5, 2026-11-11)
- **Today:** an accepted quotation becomes exactly one shipment. The database enforces it (one shipment per quote), and the staff screen refuses a second attempt with a clear message.
- **Decision needed:** must one request ever become several shipments (for example, goods split across two departures or two containers), or several requests be grouped into one shipment?
- **If delayed:** one shipment per request. Splitting or grouping would need a schema change and new rules for references, status and notifications.
- **Approved implementation recommendation (2026-11-12):** one shipment per accepted quote, as built and enforced by the database.
- **Still unresolved (business):** whether splitting or grouping consignments will ever be needed.
- **Answer:**

### SH-02 Operational shipment fields (Stage 5, 2026-11-11)
- **Today:** a shipment records its ML reference, customer, original request, service, status, an optional estimated arrival range (shown only when staff tick it; see T-02), milestones with location and EN/FR notes, and the dates it was created and last updated.
- **Decision needed:** which other details the business wants to record, and which customers may see. For example: carrier or shipping line, container number, seal number, vessel or flight, bill of lading or air waybill number, departure and arrival ports, weight and volume, collection and delivery addresses.
- **If delayed:** none of these are recorded. Staff can put them in internal notes or, for customers, in milestone notes. No carrier tracking integration exists, and the site claims none.
- **Approved implementation recommendation (2026-11-12):** no additional shipment fields until the business confirms which ones it needs.
- **Still unresolved (business):** the list of fields, and which of them customers may see (some, such as addresses, are personal data and would need a retention rule under L-03).
- **Answer:**

### SH-03 Customer emails for status changes (Stage 5, 2026-11-11)
- **Today:** the customer receives an email when the shipment is created (`shipment_confirmed`) and whenever staff record a milestone that is visible to the customer (`shipment_update`; `shipment_delivered` for the Delivered milestone). Changing the status itself (In transit, At destination, On hold, Delivered, **Cancelled**) sends the customer nothing; On hold alerts staff only. Since 2026-11-12 the status form offers the matching milestone (Delivered ticked and visible by default; In transit and On hold unticked; nothing for Cancelled), saved in the same transaction. See [STAGE-5-SHIPMENT-MANAGEMENT.md](./STAGE-5-SHIPMENT-MANAGEMENT.md).
- **Decision needed:** should a status change, and in particular a cancellation, email the customer automatically, or do staff record a visible milestone or contact the customer themselves?
- **If delayed:** unchanged. A cancelled shipment shows Cancelled in the portal and on the tracking page, without an email.
- **Approved implementation recommendation (2026-11-12):** no automatic emails for ordinary status changes; customers are updated through public milestones.
- **Still unresolved (business):** how customers are told about a cancellation. Today there is no cancellation email; staff contact the customer themselves. A cancellation email would need wording approved by the business.
- **Answer:**

### SH-04 Cancelling a booked shipment (Stage 5, 2026-11-11)
- **Today:** staff can cancel a shipment that is Booked or On hold. A shipment that is in transit or at its destination must first be put on hold. Delivered and Cancelled are final. Customers cannot cancel a shipment online. They can report a problem from the shipment page, which reaches staff as a message.
- **Decision needed:** confirm these rules, and say what the customer must be told when a shipment is cancelled (refund conditions are still open under P-06 and L-10).
- **If delayed:** unchanged.
- **Approved implementation recommendation (2026-11-12):** cancellation stays staff-controlled (the rules above); the website makes no new refund or compensation promises.
- **Still unresolved (business and legal):** what customers are told when a shipment is cancelled; refund conditions, calculation, method and timeline (P-06); voucher and compensation limits (L-10); cancellation rights for distance contracts (L-06). None of these is approved.
- **Answer:**

## 5. Contact information and customer communication

### C-01 ★ Verify contact details
- **Answered (client, 2026-11-06), published as supplied:** Ireland +353 89 484 0017, office 12 Griffeen Glen Chase, Lucan; Cameroon +237 6 59 68 54 79, Douala – Ndogsimbi; email info.cargo@marchelo-logistics.com. The old numbers and the Gmail address are no longer used. **Still open:** a WhatsApp number (optional) and opening hours (none are published). **Note:** the email address must exist as a mailbox before customers write to it (see C-02).
- **Decision needed:** confirm or correct each detail found in the old code, and say which may be published:
  - Ireland phone +353 89 616 0927 (also WhatsApp?)
  - Cameroon phone +237 695 739 033
  - Email: a personal Gmail address found in the old code (no longer used; replaced by `info.cargo@marchelo-logistics.com`, 2026-11-06)
  - Opening hours and time zones
- **Why it matters:** unverified details are never shown, so the site currently has **no visible contact channel**.
- **If delayed:** the contact page says the details are being confirmed; the launch build (`RELEASE_BUILD=true`) fails.
- **Affected:** `config/owner.ts` → `contact.*`.
- **Development can continue:** yes.
- **Answer (owner, 2026-11-09):** WhatsApp on the same two numbers: Ireland +353 89 484 0017 (https://wa.me/353894840017), Cameroon +237 6 59 68 54 79 (https://wa.me/237659685479); no other WhatsApp contact. Opening hours: open 24 hours a day, 7 days a week (EN "Open 24 hours a day, 7 days a week.", FR "Ouvert 24h/24 et 7j/7."). Both are shown on the contact page, the quote page and the footer in both languages.

### C-02 ◆ Sender email domain and notification inbox
- **Decision needed:** the domain to send transactional emails from (DNS records must be added there), the sender name and address, and the internal inbox for new-request notifications.
- **Why it matters:** emails cannot be sent without a verified domain in Resend.
- **Recommended:** a subdomain such as `notify.<your-domain>`, so the existing mailbox setup is not affected.
- **If delayed:** transactional email stays disabled (`ENABLE_TRANSACTIONAL_EMAIL=false`); quote submission stays disabled because customers would get no acknowledgement.
- **Development can continue:** yes.
- **Answer:**

### C-03 Customer account onboarding
- **Decision needed:** may anyone register a customer account, or should accounts be created only by invitation from staff?
- **Recommended:** invitation only at first. Customers can still request quotes and track without an account.
- **If delayed:** self-registration is **off** (`ENABLE_CUSTOMER_REGISTRATION=false`); staff invite customers from the admin area.
- **Development can continue:** yes.
- **Answer (owner, 2026-11-04):** **open public customer registration**. Anyone may register without an invitation, with mandatory email verification, secure authentication, customer-only role assignment, rate limiting and protection against privilege escalation.
- **Implemented (2026-11-04):** see [SECURITY.md](./SECURITY.md#customer-registration-c-03). Production switch-on needs: Supabase Auth "Allow new users to sign up" **on** and "Confirm email" **on**, the confirmation template, custom SMTP (C-02; Supabase's built-in mailer is not for production use), then `ENABLE_CUSTOMER_REGISTRATION=true` ([DEPLOYMENT.md](./DEPLOYMENT.md#customer-registration-c-03-switch-on)). Staff invitations keep working alongside.
- **Launch deferred (owner, 2026-11-08):** public registration stays **closed** until the official launch. Locally `supabase/config.toml` has `[auth] enable_signup = false`; the website form stays off (`ENABLE_CUSTOMER_REGISTRATION=false`). Existing users sign in normally and staff invitations keep working. The hosted project must be closed in its dashboard (see DEPLOYMENT.md, "Public registration closed").

## 6. Legal, privacy and document retention

### L-01 ★ Terms and conditions of carriage
- **Decision needed:** approved terms (liability limits, claims process, packing responsibilities, payment terms), ideally reviewed by a solicitor.
- **If delayed:** `/terms` is not published (returns 404); the launch build (`RELEASE_BUILD=true`) fails.
- **Development can continue:** yes.
- **Answer:**

### L-02 ★ Privacy notice
- **Decision needed:** data controller identity and contact; whether a solicitor or DPO reviews the notice. The site provides a factual draft of what data is collected and why, generated from the actual code.
- **If delayed:** the privacy page shows the factual draft with the controller details marked as pending; the launch build (`RELEASE_BUILD=true`) fails.
- **Development can continue:** yes.
- **Answer (partial, client, 2026-11-10):** the client names a data controller: the person named by the client (held privately, not recorded in this repository). **Not published yet:** under the GDPR the controller is normally the company (MARCHELO LOGISTICS CARGO LTD), with a named contact person. The lawyer should confirm the wording before the privacy notice is approved.

### L-03 ◆ Retention periods
- **Decision needed:** how long to keep quote requests that never became shipments; shipment records; customer documents (IDs, invoices, photos); audit logs.
- **Why it matters:** GDPR requires retention limits, while tax and customs rules may require minimum periods.
- **If delayed:** **nothing is deleted automatically** (`retention_until` stays empty); document uploads stay disabled.
- **Development can continue:** yes.
- **Stage 6 note (2026-11-13):** uploads now work end to end (4 MB limit, staff and customer views, staff upload, staff alert), tested locally only. They stay **switched off in production** until this decision is answered and enabling them is approved separately. Deleting documents (by customers, staff or the retention job) is not implemented and also waits for this answer.
- **Answer:**

### L-04 ★ Cookie policy
- **Decision needed:** legal review of the cookie policy and banner wording. The inventory (strictly necessary cookies only) is verified; see [docs/legal/cookie-policy.md](./legal/cookie-policy.md).
- **If delayed:** `/cookies` shows a draft notice; the launch build fails.
- **Answer:**

### L-05 Liability, insurance and carriage regime
- **Decision needed:** our legal role (carrier, forwarder or consolidator), liability limits, exclusions, whether insurance is offered, and declared values. This determines which conventions apply (Montreal, Hague-Visby, CMR).
- **Answer:**

### L-06 Cancellation right for distance contracts
- **Decision needed:** how the consumer right to cancel (Consumer Rights Act 2022) applies to quotations accepted online, and the required information and form.
- **Answer:**

### L-07 Claims and complaints
- **Decision needed:** notification and claim deadlines, acknowledgement and response times, and escalation and dispute-resolution bodies (Ireland and Cameroon).
- **Draft:** [docs/legal/claims-complaints.md](./legal/claims-complaints.md).
- **Answer:**

## 7. Logo, images and other brand assets

### A-01 ★ Logo approval
- **Decision needed:** is `public/LOGO.png` (reads "MARCHELO LOGISTICS CARGO") the official logo? Is there a vector (SVG) version?
- **If delayed:** a neutral icon and text are used; the launch build (`RELEASE_BUILD=true`) fails.
- **Affected:** `config/owner.ts` → `brand.logo`; `public/brand/*.svg`.
- **Development can continue:** yes.
- **Answer (2026-11-04, developer instruction):** use the logo on every page. It was vectorised from `public/LOGO.png` by colour-separated tracing (its own black #010101 and blue #0796da): `public/brand/marchelo-logo.svg` (header, portal/staff areas, 404/error pages), `marchelo-logo-reversed.svg` (white instead of black, for the dark footer) and `marchelo-mark.svg` (symbol only; the favicon). **Still open:** the artwork reads “MARCHELO LOGISTICS CARGO” while the business name is “Marchelo Logistics” (B-01). The owner should confirm this artwork or supply the designer’s original vector file, which would replace the traced version.

### A-02 Photographs
- **Status (2026-11-04, developer instruction):** the site now uses five licensed Unsplash photographs of the industry (never presented as our own staff, vehicles or premises) and an original illustration family; every source and licence is in [ASSET-CREDITS.md](ASSET-CREDITS.md). The two photos supplied with the project (`assets/photos/yard-loading-container.jpeg`, `assets/photos/side-loader-container.jpeg`) are **no longer shown**: the first carries a large shipping-line logo (Hapag-Lloyd) and no crop kept the scene without it; the second is 300×300 pixels and shows a lifting-equipment brand. The files stay in `assets/photos`.
- **Decision needed:** (1) can the owner supply new photos of their own operation (loading, barrels, the depot) without third-party logos, at full camera resolution? Real photos would be the most convincing on the About page. (2) For any such photo: confirm the right to use it and that the people shown agree to appear (GDPR: they may be identifiable).
- **If refused:** nothing to do; the licensed photos and illustrations remain.
- **Development can continue:** yes.
- **Answer:**

## 8. Production deployment and launch approval

### R-01 ◆ Accounts and region
- **Decision needed:** who owns the Vercel and Supabase accounts (business email recommended); approve the Supabase region (Frankfurt `eu-central-1` or Ireland `eu-west-1`) and the plan tiers after checking current pricing.
- **If delayed:** development continues locally; no preview deployment or hosted database.
- **Development can continue:** yes.
- **Answer:**

### R-02 ◆ Apply the database migration
- **Decision needed:** approval to apply the reviewed SQL in `prisma/migrations/` to the Supabase project (see [DATABASE.md](./DATABASE.md)).
- **Answer (2026-11-03, developer instruction):** approved, and made automatic: every Vercel **production** deployment applies pending migrations (`postbuild` → `scripts/deploy-migrate.mjs` → `prisma migrate deploy`). Previews never migrate. See [DEPLOYMENT.md](./DEPLOYMENT.md).
- **If delayed:** the hosted database stays empty; database features stay unavailable outside local development.
- **Development can continue:** yes.
- **Answer:**

### R-03 ★ Launch and the live WordPress site
- **Decision needed:** when the new site may go live, and what happens to the WordPress site on `marchelo-logistics.com` (keep, redirect, or replace; which URLs need redirects; any email currently tied to that hosting).
- **Why it matters:** domain and DNS changes can disrupt the current site and email.
- **If delayed:** nothing changes on the live site; the new site runs on preview URLs only.
- **Development can continue:** yes.
- **Answer:**

---

## Conflicts recorded

| Topic | Evidence | Resolution needed |
|---|---|---|
| Business name | Brief: "Marcel Logistics" · Live site and logo: "Marchelo Logistics (Cargo)" · Old code: "Machelo" | Resolved 2026-11-03: "Marchelo Logistics" (B-01). The logo still reads "…LOGISTICS CARGO" and stays hidden until A-01 |
| Contact email | Gmail address in old code vs. branded domain on the live site | C-01 |

## Additions (2026-11-04, backend MVP)
- **N-01 Quote expiry reminders:** should customers get an email before a quotation expires, and how long before (e.g. 48 hours)? Built and tested; **off** until answered (`notifications.quoteExpiryReminderHours`).
- **N-02 Staff notification inbox:** **updated 2026-11-09 (P-01):** quotation and other staff alerts go to the **owner/admin notification address** chosen by the owner, who reviews every request personally. Earlier answer (2026-11-04): a dedicated business inbox, not a personal address. The owner sets it in Vercel as `STAFF_NOTIFICATION_EMAIL` (comma-separated, max 10); no address is chosen, invented or hard-coded in the code. Until it is set, alerts are recorded as skipped, not sent. Linked to C-02 (the inbox should be on the business domain once it exists).
- **N-03 Delivery speed of emails on the Hobby plan:** emails go out immediately after each action; failed ones are retried by a daily job (Hobby limit). A Pro plan allows retries every few minutes.

## 9. Stage 3 client information (2026-11-10)

The client supplied an official price list and customer information, confirmed by the owner. It is implemented in `config/catalogue.ts` (prices), `config/owner.ts` (company, addresses) and `messages/*.json` (guide, FAQ, service pages). See [STAGE-3-PRICING-CATALOGUE.md](./STAGE-3-PRICING-CATALOGUE.md). The questions below came up while implementing it. Until they are answered, the site shows the safe behaviour described.

### P-07 Overlapping television bands
- **Issue:** the client lists 47–55 inches at €100 and 55–65 inches at €150. A 55-inch screen falls in both.
- **Today:** both bands are shown exactly as supplied, each with the note “Is your screen exactly 55 inches? We confirm its price in your quotation.” The site never assigns a 55-inch screen to a band.
- **Answer:**

### P-08 Parcel weights without a price
- **Issue:** a small parcel is “up to 15 kg, from €40” and a standard parcel “20–50 kg, individual quotation”. Nothing is stated for 15–20 kg or over 50 kg.
- **Today:** the price list says there is no published price for these weights and asks the customer to request a quote.
- **Answer:**

### P-09 Storage charge in XAF
- **Issue:** goods are kept free for 48 hours, then storage costs 2,000 XAF per day. Every other price is in EUR, and the premises are not named (Douala is assumed from the currency, but not stated on the site).
- **Today:** shown as “2,000 XAF per day” with a note that it is charged in CFA francs. It is never converted to euros.
- **Answer:**

### P-10 XAF in the staff quotation form
- **Issue:** XAF is accepted only for shipments from Cameroon to Ireland. The staff quotation form currently allows EUR or XAF on any route.
- **Proposed:** refuse XAF quotations on the Ireland → Cameroon route, on the server and in the form. Not implemented, because it changes live staff behaviour; awaiting approval.
- **Answer:**

### S-05 Quote-form grouping
- **Issue:** the quote form has six service codes. In the quote form, furniture, televisions, bicycles and mattresses appear under “Parcels and personal effects”, and standard cartons under “Barrels and boxes” (`QUOTE_SERVICE_SECTIONS` in `config/catalogue.ts`).
- **Answer:** confirm, or say which service they belong to.

### S-06 Drop-off points
- **Issue:** drop-off at collection points is possible, but no addresses were supplied.
- **Today:** the site says “ask us where”. No address is invented.
- **Answer:**

### C-04 Additional Irish phone number
- **Issue:** the client supplied an extra Irish number, +353 896 160 927 (the same digits as +353 89 616 0927 on the old website). Its role is not stated.
- **Today:** not published anywhere on the site.
- **Answer:** its role (calls, WhatsApp, a person), and whether to publish it.

### L-08 ★ Standard trading conditions (BIFA, UKWA, RHA)
- **Issue:** the client refers to BIFA, UKWA and RHA standard trading conditions via a third-party (Kuehne+Nagel) link. The published BIFA 2025 conditions are for current BIFA members only. No membership is evidenced.
- **Today:** not referenced or copied anywhere; no membership is claimed.
- **Needed:** confirmation of membership and the right to use any standard conditions, or bespoke terms drafted by a lawyer (L-01).
- **Answer:**

### L-09 Proposed fee for prohibited goods
- **Issue:** the client proposes a €150 “administrative fine” when prohibited goods are found.
- **Today:** not published. It must not be presented as a statutory or government fine. If it is kept, it needs to be a contractual charge in approved terms.
- **Answer:**

### L-10 ★ Lost or damaged goods
- **Issue:** the client’s policy is a shipping voucher for future shipments rather than a cash refund, with compensation capped at €400 per shipment.
- **Today:** not published. The guide says the policy is being finalised and asks customers to contact the business straight away. Legal review is needed against Irish consumer law and the carriage conventions (L-05, L-07).
- **Answer:**

### L-11 VAT and customs statements
- **Issue:** “listed prices include applicable VAT” and “customs clearance is included for parcels and personal effects” are published as customer information on the price list, guide and FAQ.
- **Needed:** legal and accounting review before they are used as contractual assurances in terms or quotations; the VAT number (B-02).
- **Structured data:** the machine-readable price list (`/prices`, schema.org `OfferCatalog`) deliberately carries **no** `valueAddedTaxIncluded` property until this review approves that representation. The visible text is unchanged.
- **Answer:**

### S-07 Which services the collection, delivery and storage rules apply to
- **Issue:** the client's rules (drop-off at collection points, home collection in the Dublin region for €25, quotations for other Irish locations, delivery in Cameroon, 48 hours' free storage then 2,000 XAF per day) were supplied in general terms.
- **Today:** they appear on the full price list, the shipping guide and the FAQ as general information. On the service pages, the collection block and the collection price table appear **only for parcels and personal effects, and barrels and cartons**. They are not shown for vehicles, sea freight (including full containers), air freight, commercial cargo, warehousing or e-commerce.
- **Answer:** for each of vehicles, full containers, air freight, commercial cargo, warehousing and e-commerce: do drop-off, home collection, delivery in Cameroon and the storage rule apply, and on what terms?

### A-03 Account self-service (Stage 4, 2026-11-10)
- **Issue:** customers can change their name, phone, language and password, and sign out on all devices. Changing the sign-in email, deleting the account and exporting their data are not self-service: they go through the business by email.
- **Decision needed:** keep these as requests handled by the business, or build self-service versions (email change needs a confirmation email to both addresses; deletion and export need the retention rules in L-03).
- **Answer:**

## 10. Stage 6 supporting features (2026-11-13)

Implementation record: [STAGE-6-SUPPORTING-FEATURES.md](./STAGE-6-SUPPORTING-FEATURES.md). The four implementation decisions below were answered by the owner; they are technical choices, not business or legal policy.

### D1 ✓ Document upload size
- **Answer (owner, 2026-11-13):** maximum 4 MB per file (PDF, JPEG, PNG). Implemented; a 4 MB file was uploaded and downloaded intact through a real browser on the local stack.

### D2 ✓ Staff upload form
- **Answer (owner, 2026-11-13):** yes, behind the existing `ENABLE_DOCUMENT_UPLOADS` switch, which stays off in production.

### D3 ✓ Audit detail
- **Answer (owner, 2026-11-13):** staff see which fields changed, never the old or new values.

### D4 ✓ Manual retry of DEAD emails
- **Answer (owner, 2026-11-13):** no. A DEAD email stays visible on the notifications page with its error; staff contact the person by other means if needed.

### Still open after Stage 6 (not approved; nothing implemented)
- **L-03:** retention periods; enabling uploads in production; any deletion of documents.
- Whether customers may remove documents they uploaded by mistake (depends on L-03).
- Which documents customers are asked to provide (no document types are defined).
- Audit export, and recording who downloaded a document (the latter would need a database migration).
- Customer notification preferences or opt-outs (transactional emails only today).
- N-01 quotation expiry reminders (built, off).
- SH-03 cancellation message to customers.
