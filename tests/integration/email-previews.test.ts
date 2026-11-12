import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { render } from "@react-email/components";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import { loadAppUser, setUserRole } from "@/lib/services/users";
import { issueQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import { requestInformation, respondViaLink, submitContactEnquiry, reportShipmentIssue } from "@/lib/services/cases";
import { createQuoteToken } from "@/lib/services/quote-links";
import { addShipmentEvent, createShipmentForRequest } from "@/lib/services/shipments";
import { runJob } from "@/lib/services/jobs";
import { emailElement, renderOutboxEmail, type OutboxRow } from "@/lib/email/render";
import { plainTextEmail } from "@/lib/email/templates";

/*
 * Renders EVERY email template in English and French from real database records
 * (PGlite), including a very long customer name and every optional section.
 * Asserts each has a subject, HTML and plain text, no unresolved placeholders and
 * no owner markers. With EMAIL_PREVIEW_DIR set, writes the HTML for visual review.
 */

const CUSTOMER_TEMPLATES = [
  "quote_received", "quote_under_review", "info_requested", "quote_issued", "quote_updated", "quote_expiring", "quote_expired",
  "quote_accepted", "quote_declined", "shipment_confirmed", "shipment_update", "shipment_delivered", "contact_received",
];
const STAFF_TEMPLATES = [
  "staff_new_request", "staff_customer_message", "staff_quote_accepted", "staff_quote_declined", "staff_shipment_exception",
  "staff_contact", "staff_role_changed", "staff_email_failure", "staff_job_failure", "staff_document_uploaded",
];

let t: TestDb;
let db: Database;
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  process.env.QUOTE_LINK_SECRET = "preview-secret-that-is-longer-than-32-characters";
  t = await createTestDb();
  db = t.db as unknown as Database;
  const s = await createUser(t.client, "preview.staff@example.test", "staff", "Staff");
  const a = await createUser(t.client, "preview.admin@example.test", "admin", "Admin");
  const staff = (await loadAppUser(db, s.id, "preview.staff@example.test"))!;
  const admin = (await loadAppUser(db, a.id, "preview.admin@example.test"))!;
  const longName = "Marie-Christine Ngo Biyong Épse Ndjock-Tchoumbou de la Fontaine";
  const submit = async (locale: "en" | "fr") => {
    const r = await submitQuoteRequest(
      db,
      {
        service: "barrels",
        originCountry: "IE",
        destinationCountry: "CM",
        destinationCity: "Yaoundé",
        items: [{ description: "Barrel of clothes", quantity: "2" }],
        contact: { name: longName, email: `${locale}.${randomUUID().slice(0, 6)}@example.test`, phone: "+353 89 123 4567" },
        locale,
        idempotencyKey: randomUUID(),
        privacyAccepted: true,
        website: "",
      },
      { user: null, clientId: randomUUID() },
      { available: true },
    );
    if (!r.ok) throw new Error(r.code);
    return r;
  };
  const r = await submit("fr");
  await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
  await requestInformation(db, staff, { requestId: r.requestId, body: "Could you confirm the size of each barrel (in litres) and the collection address in Dublin?" });
  await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
  const lines = [
    { kind: "charge", description: "Barrel (220 L), Dublin to Douala, sea freight", quantity: "2", unitPrice: "150.00" },
    { kind: "charge", description: "Collection in Dublin", quantity: "1", unitPrice: "25.00" },
    { kind: "discount", description: "Returning customer", quantity: "1", unitPrice: "10.00" },
  ];
  await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(2), inclusions: "Port handling in Douala", exclusions: "Customs duties and taxes in Cameroon", lines });
  await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
  await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(2), lines });
  await respondViaLink(db, createQuoteToken(r.reference)!, true, randomUUID());
  const sh = await createShipmentForRequest(db, staff, r.requestId);
  if (!sh.ok) throw new Error(sh.code);
  const shipmentId = (await t.client.query<{ id: string }>("select id from public.shipments where reference = $1", [sh.data!.reference])).rows[0].id;
  await addShipmentEvent(db, staff, { shipmentId, milestone: "DEPARTED_ORIGIN", occurredAt: new Date().toISOString(), public: true, location: "Dublin Port" });
  await addShipmentEvent(db, staff, { shipmentId, milestone: "DELAYED", occurredAt: new Date().toISOString(), public: false });
  await addShipmentEvent(db, staff, { shipmentId, milestone: "DELIVERED", occurredAt: new Date().toISOString(), public: true, location: "Yaoundé" });
  const customerUser = await createUser(t.client, "preview.customer@example.test", "customer", "Customer");
  void customerUser;
  await reportShipmentIssue(db, staff, sh.data!.reference, "x").catch(() => undefined); // staff has no customer: no message
  await t.client.query(`insert into public.case_messages (quote_request_id, shipment_id, author_kind, internal, kind, body) values ($1, $2, 'customer', false, 'issue_report', 'One barrel arrived damaged.')`, [r.requestId, shipmentId]);

  const declined = await submit("en");
  await transitionQuoteRequest(db, staff, { requestId: declined.requestId, to: "UNDER_REVIEW" });
  await issueQuote(db, staff, { requestId: declined.requestId, currency: "XAF", validUntil: inDays(30), lines: [{ kind: "charge", description: "Carton", quantity: "3", unitPrice: "15000" }] });
  await respondViaLink(db, createQuoteToken(declined.reference)!, false, randomUUID());

  const expired = await submit("en");
  await transitionQuoteRequest(db, staff, { requestId: expired.requestId, to: "UNDER_REVIEW" });
  await issueQuote(db, staff, { requestId: expired.requestId, currency: "EUR", validUntil: inDays(1), lines: [{ kind: "charge", description: "Parcel", quantity: "1", unitPrice: "40" }] });
  await t.client.query(`select public.app_enqueue_email('quote_expiring', 'customer', 'quote_requests', $1, 'preview-expiring', 'x@example.test', 'en', jsonb_build_object('quoteId', (select id from public.quotes where quote_request_id = $2::uuid)))`, [expired.requestId, expired.requestId]);
  await t.client.exec(`begin; alter table public.quotes disable trigger quotes_rules; update public.quotes set created_at = now() - interval '3 days', valid_until = now() - interval '1 hour' where quote_request_id = '${expired.requestId}'; alter table public.quotes enable trigger quotes_rules; commit;`);
  await t.client.query("select public.app_expire_quotes()");

  await submitContactEnquiry(db, { name: longName, email: "contact.preview@example.test", topic: "shipment", relatedReference: sh.data!.reference, message: "When will my barrels arrive in Yaoundé?", locale: "fr", idempotencyKey: randomUUID(), privacyAccepted: true }, randomUUID());
  await setUserRole(db, admin, s.id, "admin");
  await t.client.query(`select public.app_enqueue_email('staff_email_failure', 'staff', 'email_deliveries', 'x', 'preview-failure', null, 'en', '{"template":"quote_issued","status":"BOUNCED","reference":"QRABCDEF"}'::jsonb)`);
  // Stage 6: a customer document on the shipment (inserted directly; the upload service is tested in documents.test.ts).
  const [doc] = (await t.client.query<{ id: string }>("insert into public.documents (owner_type, owner_id, storage_key, original_name, mime, size_bytes, uploaded_by) values ('shipment', $1, 'preview/key.pdf', 'private-name.pdf', 'application/pdf', 245760, $2) returning id", [shipmentId, s.id])).rows;
  await t.client.query("select public.app_enqueue_email('staff_document_uploaded', 'staff', 'documents', $1, $2, null, 'en', '{}')", [doc.id, `staff_document_uploaded:${doc.id}`]);
  await runJob(db, "preview-job", async () => Promise.reject(new Error("database timeout"))).catch(() => undefined);
}, 120_000);
afterAll(async () => {
  delete process.env.QUOTE_LINK_SECRET;
  await t?.close();
});

describe("every email template renders correctly in both languages", () => {
  it("covers all templates with subject, HTML and plain text, and no placeholders left", async () => {
    const rows = (
      await t.client.query<{ id: string; template: string; audience: string; recipient: string | null; locale: string; entity: string; entity_id: string; payload: Record<string, unknown> }>(
        "select distinct on (template) id, template, audience, recipient, locale::text as locale, entity, entity_id, payload from public.email_deliveries order by template, created_at desc",
      )
    ).rows;
    const templates = rows.map((r) => r.template).sort();
    expect(templates).toEqual([...CUSTOMER_TEMPLATES, ...STAFF_TEMPLATES].sort());

    const dir = process.env.EMAIL_PREVIEW_DIR;
    if (dir) mkdirSync(dir, { recursive: true });
    for (const raw of rows) {
      for (const locale of raw.audience === "staff" ? (["en"] as const) : (["en", "fr"] as const)) {
        const row: OutboxRow = { id: raw.id, template: raw.template, audience: raw.audience as "customer" | "staff", recipient: raw.recipient, locale, entity: raw.entity, entityId: raw.entity_id, payload: raw.payload };
        const rendered = await renderOutboxEmail(db, row);
        expect("props" in rendered, `${raw.template}/${locale}: ${"skip" in rendered ? rendered.skip : ""}`).toBe(true);
        if (!("props" in rendered)) continue;
        const html = await render(emailElement(rendered.props));
        const text = plainTextEmail(rendered.props);
        const label = `${raw.template}/${locale}`;
        expect(rendered.subject.length, label).toBeGreaterThan(5);
        expect(html, label).toContain(`lang="${locale}"`);
        expect(text.length, label).toBeGreaterThan(80);
        for (const content of [rendered.subject, html, text]) {
          expect(content, label).not.toMatch(/\{[a-zA-Z]+\}|NEEDS_OWNER|undefined|\[object Object\]|emails\./);
        }
        if (raw.audience === "customer") expect(html, label).toContain(`/${locale}/contact`);
        if (rendered.props.cta) expect(text, label).toContain(rendered.props.cta.href);
        for (const fact of rendered.props.facts ?? []) expect(text, label).toContain(`${fact.label}: ${fact.value}`);
        if (dir) {
          writeFileSync(join(dir, `${raw.template}.${locale}.html`), html);
          writeFileSync(join(dir, `${raw.template}.${locale}.txt`), `Subject: ${rendered.subject}\n\n${text}`);
        }
      }
    }
  });
});
