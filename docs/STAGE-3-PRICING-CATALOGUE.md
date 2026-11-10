# Stage 3: official price catalogue and customer information

_Implemented 2026-11-10 on branch `feat/stage-3-pricing-catalogue` (from `master` @ `f215ff0`), corrected after the release review the same day. Not merged, pushed or deployed._

## Source

The client's price list and customer information, confirmed as official by the owner on 2026-11-10. Questions raised while implementing it are recorded in [DECISIONS-REQUIRED.md, section 9](./DECISIONS-REQUIRED.md#9-stage-3-client-information-2026-11-10): P-07 to P-10, S-05, S-06, C-04 and L-08 to L-11.

## Single source of truth

| What | Where |
|---|---|
| Every price (amount, kind, currency, flags) | `config/catalogue.ts` → `CATALOGUE` |
| Which price sections each service page shows | `config/catalogue.ts` → `SERVICE_SECTIONS` |
| Which items a customer may pick per quote service | `config/catalogue.ts` → `QUOTE_SERVICE_SECTIONS` |
| Company names, registration and VAT numbers (null), addresses | `config/owner.ts` → `company`, `locations` |
| Labels, examples, notes, guide, FAQ and service-page text (EN and FR) | `messages/*.json` → `catalogue`, `pricesPage`, `serviceDetail`, `prohibited`, `guide`, `faq` |
| Lookup and formatting helpers (pure, no totals) | `lib/domain/catalogue.ts` |
| Display components | `components/pricing/price-table.tsx` (`PriceTable`, `PriceLabel`, `usePriceText`, `PricingDisclosure`) |

**Price kinds:** `fixed` (€20), `from` (From €1,400), `range` (€50–€70), `per_kg` (€14 per kg, from 1 kg), `per_day` (2,000 XAF per day), `quote` (Individual quotation). Amounts are whole currency units. Page components never contain amounts. Messages never contain amounts (a unit test checks this for the €400 and €150 legal-review figures).

**To change a price:** edit the amount in `config/catalogue.ts`. To add an item, add it there with a new key, add `catalogue.items.<section>.<key>.label` in both message files, and run `npm test` (the catalogue tests check labels, uniqueness and positive whole amounts).

## Pages

| Route | Content |
|---|---|
| `/prices` (new) | All catalogue sections with a table of contents, the pricing disclosure (EUR, VAT included, guide prices, written quotation is final) and an `OfferCatalog` JSON-LD block |
| `/services/[service]` (new, nine pages) | What is carried, options, conditions, collection and delivery, what to include in a quote request, the relevant price tables, a pre-selected quote link (`/quote?service=…`) or the contact page for the three support services |
| `/services` | Each service links to its detail page; new “See our prices” button |
| `/shipping-guide` | Rewritten: rates and quotations, payment, VAT and customs, collection and delivery, departure schedule, cancellations and delays, the official prohibited goods list (`#prohibited`), then the existing packing advice |
| `/faq` | Grouped by topic (17 questions) with `FAQPage` JSON-LD |
| `/about`, footer | Legal entity and trading name; full addresses on the contact blocks |
| Header “Send” menu, footer | New “Prices” link |
| Sitemap | Adds `/prices` and the nine service pages (robots still blocks indexing until the launch build) |

JSON-LD is rendered with the per-request CSP nonce (`components/app/json-ld.tsx`). The FAQ data includes the departure windows that the page shows under the departures answer. The price list data has no VAT property (L-11).

## Quotation workflow integration

There is no second quotation system and no automatic price. Changes are additive:

- `/quote?service=<code>&item=<section.item>` pre-selects the service and the first item's catalogue choice. Unknown or mismatched values are ignored.
- The items step offers an optional **Item type** (or **Vehicle category**) select per item, grouped by catalogue section. It shows the guide price or “This item needs an individual quotation”. It pre-fills an empty description, and links to `/prices`. Surcharges and fees (certificates, collection, storage) cannot be chosen.
- Vehicles get an optional **Shipping method** (container or RORO).
- The review step shows the choice and its guide price.
- **Server validation:** `quoteRequestInputSchema` accepts optional `catalogueItem` (generic and vehicle items) and `shippingMethod` (vehicle). A `superRefine` rejects a catalogue key that is not a selectable item of the chosen service. The honeypot, rate limits, idempotency and route checks are unchanged.
- **Storage:** the new keys are stored in the existing `quote_requests.items` JSON column. **No migration.** The existing check (array of 1–50 items, ≤ 32 KB) still applies.
- **Customer views** (portal request page) show the chosen item **by name only**. **Staff views** add `Current guide price (reference only): …`, read from today's catalogue (not stored with the request). The written quotation is the only price that applies. Older requests render as before.
- The quote form shows the guide price while the customer is filling it in (items step and review), where it is current by definition.
- **Emails are unchanged.** Templates do not render items.

## Not published (legal review)

The following are not on the website: BIFA, UKWA and RHA conditions; the €150 prohibited-goods fee; the voucher-only and €400 compensation policy; the data controller's personal name. See L-02 and L-08 to L-11 and [legal/README.md](./legal/README.md#stage-3-client-supplied-terms-2026-11-10). The guide says the lost/damaged-goods policy is being finalised, and states that the published business policies do not affect statutory rights.

## Verification (local, 2026-11-10)

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint` | pass (no findings) |
| `check:i18n` | pass, 1,258 keys in each locale |
| `check:security` | pass, 184 files |
| `check:owner` | 4 markers, unchanged (allowed until the launch build) |
| `vitest run` (unit, integration, PGlite database) | 24 files, 247 tests passed (baseline 231). New: `tests/unit/catalogue.test.ts` (15) and one integration test (catalogue choice stored, mismatched choice rejected, nothing stored) |
| `next build` | pass; migration step skipped (not a Vercel production build) |
| Playwright e2e (desktop Chrome and Pixel 7, against the production build) | 174 passed, 4 skipped (existing device-specific skips), 0 failed. New: `tests/e2e/stage3.spec.ts` (12 tests × 2 devices); new pages added to the layout, language and axe accessibility checks |
| Local Supabase tests | 22 passed, 3 skipped (unchanged) |
| Full-stack journeys (local Supabase, mock Resend) | 7 passed, 1 skipped (unchanged; covers submission, staff quotation, customer reply and acceptance) |

**Known flake (pre-existing):** a PGlite-backed test file sometimes fails in setup when all files start in parallel (seen on `tests/db/rls.test.ts` in the baseline and once on `quote-workflow.test.ts`). It passes when re-run, with no code change.

## Production deployment notes (for approval; nothing deployed)

- No environment variable, feature flag, migration, DNS or Supabase change is needed.
- The live quote form changes: new optional fields are added and nothing is removed. Requests in flight during a deploy still validate, because the new fields are optional.
- Visible content changes: the guide's “Ask us before packing these” list is replaced by the official prohibited list. The FAQ is restructured. The footer gains the legal-entity line.
- Rollback: Instant Rollback to the previous production deployment. No data needs undoing, because stored items with `catalogueItem` remain valid JSON and older code ignores unknown keys when rendering.
- **Known rollback edge case (stale form):** after a rollback, a visitor who still has the Stage 3 quote page open and chose an item type (or a vehicle shipping method) submits fields the previous server does not accept. Its strict validation returns “Please correct the highlighted fields.” and nothing is stored or emailed. Reloading the page loads the previous form, and the submission then works. No data is lost or corrupted; the visitor's entries are kept on screen.

## Corrections after the release review (2026-11-10)

| Review item | Change |
|---|---|
| S3-1 Personal name in a public repository | Removed from `docs/DECISIONS-REQUIRED.md`, `docs/legal/README.md` and `cspell.json`, and from the Stage 3 commit itself (the unpushed commit was rewritten; `master` untouched) |
| S3-2 Collection block scope | Collection block and collection price table only on the parcels and barrels pages; warehousing no longer shows the storage line. Question recorded as S-07 |
| S3-3 Express wording | “Monthly express departures” removed from the parcels, air freight and e-commerce pages; the schedule is no longer attached to individual services. The air section note now repeats the client's statement “Express air freight is charged by the kilogram.” The confirmed schedule remains on the general pages |
| S3-4 Guide price on requests | Customers see the item name only; staff see “Current guide price (reference only)” |
| S3-5 FAQ structured data | The departures answer includes the windows and the “ask us for the exact date” line shown on the page |
| S3-6 VAT structured data | `valueAddedTaxIncluded` removed; recorded under L-11 |
