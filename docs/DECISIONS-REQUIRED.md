# Decisions Required from the Owner

_Last updated: 2026-11-03 · This is the single consolidated list of open **business** decisions._

**How to answer:** write your answer on the `Answer:` line under each decision (or reply by email quoting the ID). Answers already recorded here are preserved. Development continues on everything that does not depend on an answer.

**How unresolved items are handled in the code:** every unresolved fact carries the marker `{{NEEDS_OWNER}}` (in `config/owner.ts` or `messages/*.json`). Visitors never see the marker; a neutral fallback or nothing is shown instead. The **launch build** (`RELEASE_BUILD=true`) **fails** while any marker remains; Vercel preview and pre-launch production builds only list them as warnings (`npm run check:owner` lists them).

Technical decisions (stack, database, auth, hosting, email provider, testing) are settled by the project directive and documented in [ARCHITECTURE.md](./ARCHITECTURE.md). They are not repeated here.

### Quick index (★ = blocks a release; ◆ = blocks enabling a feature)

| ID | Decision | Blocks |
|---|---|---|
| B-01 ✓ | Official business name: **Marchelo Logistics** (answered 2026-11-03) | — |
| B-02 ★ | Legal entity, registration and VAT details | Release (legal pages, footer) |
| S-01 ★ | Which services are offered now | Release (services shown as "to be confirmed") |
| S-02 | Routes and destination cities (routes and monthly windows answered 2026-11-03; cities open) | Quote form options |
| S-03 | Prohibited and restricted items | Service pages, FAQ |
| P-01 ◆ | Who reviews quotes and the response-time wording | Enabling quote submission |
| P-02 | Information required per service | Quote form fields |
| P-03 | Currencies, VAT presentation, quote validity | Staff quote form defaults |
| P-04 | Customs duties: included or not | Quote inclusions/exclusions wording |
| T-01 | Tracking milestones shown to customers | Tracking page labels |
| T-02 | Delivery-estimate policy | Whether ETAs are shown |
| C-01 ★ | Verify contact details | Release (contact page currently says "being confirmed") |
| C-02 ◆ | Sender email domain and staff notification inbox | Enabling email |
| C-03 | Customer account onboarding: open registration or invitation only | Enabling registration |
| L-01 ★ | Terms and conditions of carriage | Release (terms page hidden) |
| L-02 ★ | Privacy notice: controller identity and contact | Release |
| L-03 ◆ | Document and data retention periods | Enabling uploads; automatic deletion |
| A-01 ★ | Logo approval | Release (logo hidden) |
| A-02 | Photographs | Visual quality only |
| R-01 ◆ | Vercel and Supabase account ownership and EU region | Preview deployment, database |
| R-02 ✓ | Migrations applied automatically on production deployments (approved 2026-11-03) | — |
| R-03 ★ | Launch approval and relationship to the live WordPress site | Production launch |

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
- **Answer:**

## 2. Services, destinations and logistics operations

### S-01 ★ Services currently offered
- **Decision needed:** for each category, say *offered now*, *coming soon* or *not offered*: parcels and personal effects · barrels and boxes · air freight · sea freight (shared or full container) · vehicle transport · commercial cargo.
- **Why it matters:** listing a service creates customer expectations and possible liability.
- **Recommended:** confirm only what is operational today.
- **If delayed:** all six categories are shown with "Availability to be confirmed" and remain selectable in the quote form (staff can decline).
- **Affected:** `config/owner.ts` → `operations.confirmedServices`; `/services`; quote form.
- **Development can continue:** yes.
- **Answer:**

### S-02 Routes and destination cities
- **Decision needed:** origin countries (Ireland only? Northern Ireland or UK?), destination countries (Cameroon only, or other approved African countries — which?), and destination cities or collection points in Cameroon.
- **Why it matters:** these drive the quote form options and validation.
- **Recommended:** start with Ireland → Cameroon and list the cities served.
- **If delayed:** the form offers Ireland → Cameroon with a free-text destination city.
- **Affected:** `config/owner.ts` → `operations.routes`.
- **Development can continue:** yes.
- **Answer (partial, 2026-11-03, client message relayed by the developer):** « On fait déjà express shipping tous les mois : Irlande → Cameroun entre le 10 et le 15 de chaque mois, Cameroun → Irlande entre le 20 et le 25 de chaque mois. » Applied: both directions are offered online, with these monthly departure windows shown on the home, services, how-it-works and FAQ pages. **Still open:** destination cities or collection points; whether “express” means air or sea freight, and which services it covers.

### S-03 Prohibited and restricted items
- **Decision needed:** the list of items you will not carry, or carry only with conditions.
- **Why it matters:** customers need it before packing barrels and boxes; it reduces customs problems.
- **If delayed:** no binding list is published. The shipping guide (`/shipping-guide`) shows general categories under “Ask us before packing these” (flammables and gas, loose batteries, weapons, medicines and chemicals, perishable food, cash and valuables) and says the final list is confirmed in the quote.
- **Affected:** FAQ, shipping guide (`guide.restricted*` in `messages/*.json`), quote form guidance.
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
- **Answer:**

### P-02 Information required per service
- **Decision needed:** what you need in order to price each service, for example: number and size of barrels; box dimensions; vehicle make, model, year and whether it runs; container size; commercial goods description and value.
- **Why it matters:** with complete information you can price without back-and-forth.
- **If delayed:** a sensible default set is used (item list with quantity, approximate weight and dimensions; vehicle make, model and year; notes) and can be changed later.
- **Affected:** `lib/domain/quote-schema.ts`, quote form.
- **Development can continue:** yes.
- **Answer:**

### P-03 Currencies, VAT presentation and quote validity
- **Decision needed:** currencies you quote in (EUR, XAF, both); whether quotes are shown including or excluding VAT; default validity period (e.g. 14 days).
- **If delayed:** staff may choose EUR or XAF per quote; validity is entered per quote; the VAT treatment is written in the inclusions/exclusions text.
- **Affected:** staff quote form, quote display.
- **Development can continue:** yes.
- **Answer:**

### P-04 Customs duties and destination charges
- **Decision needed:** are Cameroon customs duties and taxes ever included in your quote, optional, or always paid by the recipient?
- **If delayed:** staff state it per quote in inclusions/exclusions.
- **Development can continue:** yes.
- **Answer:**

## 4. Delivery estimates and shipment tracking

### T-01 Tracking milestones shown to customers
- **Decision needed:** confirm or adjust the default stages: Booked → Received at depot → Departed origin → In transit → Arrived at destination port → In customs → Customs cleared → Ready for collection → Out for delivery → Delivered (plus "Delayed" and "On hold").
- **If delayed:** the defaults are used; staff choose which events are public.
- **Affected:** `lib/domain/milestones.ts`, translations.
- **Development can continue:** yes.
- **Answer:**

### T-02 Delivery-estimate policy
- **Decision needed:** may staff show an estimated arrival range to customers? Should a disclaimer accompany it?
- **If delayed:** ETAs can be recorded by staff but are **only** shown when staff tick "show to customer"; no default estimates exist.
- **Development can continue:** yes.
- **Answer:**

## 5. Contact information and customer communication

### C-01 ★ Verify contact details
- **Decision needed:** confirm or correct each detail found in the old code, and say which may be published:
  - Ireland phone +353 89 616 0927 (also WhatsApp?)
  - Cameroon phone +237 695 739 033
  - Email marchelodis@gmail.com (or a domain address?)
  - Opening hours and time zones
- **Why it matters:** unverified details are never shown, so the site currently has **no visible contact channel**.
- **If delayed:** the contact page says the details are being confirmed; the launch build (`RELEASE_BUILD=true`) fails.
- **Affected:** `config/owner.ts` → `contact.*`.
- **Development can continue:** yes.
- **Answer:**

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
- **Answer:**

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
- **Answer:**

### L-03 ◆ Retention periods
- **Decision needed:** how long to keep quote requests that never became shipments; shipment records; customer documents (IDs, invoices, photos); audit logs.
- **Why it matters:** GDPR requires retention limits, while tax and customs rules may require minimum periods.
- **If delayed:** **nothing is deleted automatically** (`retention_until` stays empty); document uploads stay disabled.
- **Development can continue:** yes.
- **Answer:**

## 7. Logo, images and other brand assets

### A-01 ★ Logo approval
- **Decision needed:** is `public/LOGO.png` (reads "MARCHELO LOGISTICS CARGO") the official logo? Is there a vector (SVG) version?
- **If delayed:** a neutral icon and text are used; the launch build (`RELEASE_BUILD=true`) fails.
- **Affected:** `config/owner.ts` → `brand.logo.approved`.
- **Development can continue:** yes.
- **Answer:**

### A-02 Photographs
- **Status (2026-11-03):** the two photos supplied with the project (`assets/photos/yard-loading-container.jpeg`, `assets/photos/side-loader-container.jpeg`, previously `public/work1.jpeg` and `work2.jpeg`) are now used on the home, services, about, how-it-works and shipping-guide pages, at the developer’s request. No stock photography is used; the other images are original illustrations drawn for the site.
- **Decision needed:** confirm (1) the business owns these photos or has the right to use them; (2) the people shown agree to appear on the website (GDPR: they may be identifiable); (3) whether more photos can be supplied. `side-loader-container.jpeg` is only 300×300 pixels: a larger original would look sharper.
- **If refused:** remove the entries in `components/brand/photos.tsx`; the illustrations remain.
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
