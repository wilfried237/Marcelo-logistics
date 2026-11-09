# Proposal S-04: online quotes for customs clearance, warehousing and e-commerce

Status: **proposal only. No migration file has been created and nothing has been applied.** It needs owner approval of the questions in section 5, then developer implementation, then the normal release (migrations are applied by the production deployment, R-02).

## 1. Today

| Item | State |
| --- | --- |
| PostgreSQL enum `public.service_code` | `parcels, barrels, air_freight, sea_freight, vehicle, commercial_cargo` (migration `20261029000000_initial_schema`) |
| Prisma `enum ServiceCode` and `SERVICE_CODES` (`lib/domain/services.ts`) | The same six values |
| `SERVICE_OFFERINGS` | Nine services. `customs_clearance`, `warehousing` and `ecommerce` have `quoteCode: null` and lead to the contact form ("Ask us about this service") |
| Quote form | Six services. `vehicle` has its own item schema; the other five share the generic item schema (`lib/domain/quote-schema.ts`) |
| Where `service_code` is used in the database | Columns `quote_requests.service_code` and `shipments.service_code` (copied from the request by a trigger and immutable), column grants, and JSON in the tracking function. No CHECK constraint or function branches on specific values. |
| Owner confirmation (S-01) | Customs clearance, warehousing and e-commerce are **confirmed** services |

## 2. Proposed database change (additive)

Proposed migration: `prisma/migrations/2026MMDD000000_service_codes_support/migration.sql`.

```sql
-- S-04: support services can be requested through the quote form.
-- Additive only: existing rows, grants, triggers and functions are unchanged.
alter type public.service_code add value if not exists 'customs_clearance';
alter type public.service_code add value if not exists 'warehousing';
alter type public.service_code add value if not exists 'ecommerce';
```

| Concern | Assessment |
| --- | --- |
| Existing records | Untouched. `ADD VALUE` does not rewrite tables and takes only a brief lock on the type. |
| Transactions | PostgreSQL 12 and later allow `ADD VALUE` inside a transaction block. The new value cannot be *used* in the same transaction, and this migration does not use it. Supabase runs PostgreSQL 17. |
| Backward compatibility | The current production app never writes these values. The new app writes them only after the migration has run, because migrations run in the `postbuild` step before the new deployment is promoted. A rollback to the previous app version keeps working. Reading a new value is safe because the old app's `isServiceCode` returns false and the display falls back. **To verify in implementation:** the admin and portal lists must render an unknown code without crashing. |
| Irreversibility | PostgreSQL cannot drop an enum value. If a service is withdrawn later, it is hidden in the application, not removed from the enum. |
| Rollback | No down migration. `docs/runbooks/backend-mvp-rollback.sql` is not affected. |
| Rehearsal | Apply to local Supabase and to a PGlite fresh database (`tests/db`), then run the full suite and the full-stack journeys. |

## 3. Application changes (after approval)

1. **`prisma/schema.prisma`:** add the three values to `enum ServiceCode`; regenerate the client.
2. **`lib/domain/services.ts`:** add them to `SERVICE_CODES`, and set `quoteCode` for the three support offerings.
3. **`lib/domain/quote-schema.ts`:** a third (or further) branch of the discriminated union with service-specific fields (section 5). Routes are unchanged.
4. **Quote wizard (`components/quote/quote-wizard.tsx`):** service-specific step 2. The "Ask us" contact link on the services page is replaced by "Request a quote" for these three services.
5. **Messages (EN/FR):** labels, hints and validation messages for the new fields; `services.<code>` already exists. The parity check (`scripts/check-i18n.mjs`) enforces both languages.
6. **Staff area:** filters, labels and the request detail view. The item summary must cope with the new item shapes. Emails (`staff_new_request`, customer confirmations) use `services.<code>` and need no new template.
7. **Tests:**
   - unit tests for the schema branches;
   - a PGlite migration test (insert a request with each new code);
   - an e2e test for each new form branch (EN and FR);
   - a full-stack journey for one support service;
   - a mixed-version compatibility test (the old `SERVICE_CODES` reading new rows).
8. **Docs:** `DATABASE.md`, `DECISIONS-REQUIRED.md` S-04 marked answered.

Estimate: about 1.5 to 2 developer days once section 5 is answered.

## 4. Pricing, currency, VAT, customs and extra charges

**No rates are proposed or invented.**

| Topic | Current design | What S-04 changes |
| --- | --- | --- |
| Pricing | No price list. Staff type every line (charge, discount, tax) per quotation. The arithmetic is exact (integer minor units) and re-verified in the database when a quote is sent. | Nothing. Support services are priced the same way. A storage service may need a time-based line ("per week"), which is already possible as a quantity × unit-price line with a description. |
| Currency | EUR (2 decimals) and XAF (0 decimals) | Nothing |
| VAT | `ownerConfig.pricing.taxRatesBp` is empty, so tax lines are disabled until P-03 is decided | Nothing. Customs brokerage, warehousing and international transport can have **different VAT treatments**. **[OWNER/ACCOUNTANT: P-03 per service.]** |
| Customs duties | Stated in each quotation's inclusions and exclusions text (P-04) | The customs-clearance service must state whether duties are paid on the customer's behalf and passed on at cost (disbursements) or quoted. **[OWNER: P-04.]** |
| Extra charges (storage, demurrage, re-delivery, inspection) | Free-text exclusions per quotation | Optional: a later improvement could offer a staff-maintained list of standard wording, still without amounts. **[OWNER.]** |

## 5. Questions for the owner (needed before implementation)

1. **Customs clearance.**
   - Which direction or directions?
   - Is it only for goods we ship, or also for goods shipped by others? If others, should the form ask for the bill of lading or air waybill number?
   - What are the goods, their value and their documents?
   - Fields proposed for confirmation: direction, port or airport, carrier reference (optional), description of the goods, declared value and currency, documents available (yes/no list).
2. **Warehousing and distribution.**
   - Location (Lucan? Douala? both?).
   - Fields proposed for confirmation: location, number and type of items, approximate volume, start date, expected duration, and whether onward distribution is needed.
3. **E-commerce and online shopping.**
   - Is this receiving online purchases at an Irish address for forwarding to Cameroon (parcel forwarding), or buying on the customer's behalf (assisted purchase)?
   - The second case involves handling customer money (P-05) and may change the legal role.
   - Fields proposed for confirmation: retailer, number of parcels expected, approximate value, destination.
4. **Should any of the three stay contact-only?** Leaving them as they are needs no migration.
