import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { getEmailTransport } from "@/lib/config/env";
import { MAX_ATTEMPTS, processOutbox, resendProvider, type EmailProvider } from "@/lib/email/outbox";
import { applyResendEvent } from "@/lib/email/webhook";
import { loadAppUser, setUserRole } from "@/lib/services/users";
import { issueQuote, submitQuoteRequest, transitionQuoteRequest } from "@/lib/services/quote-requests";
import { addCustomerReply, replyViaLink, reportShipmentIssue, requestInformation, respondViaLink, submitContactEnquiry } from "@/lib/services/cases";
import { createQuoteToken } from "@/lib/services/quote-links";
import { addShipmentEvent, createShipmentForRequest, updateShipment } from "@/lib/services/shipments";
import { expireQuotes, queueExpiryReminders, runJob } from "@/lib/services/jobs";

/*
 * LIVE EMAIL SCENARIOS (manual run only).
 *
 *   ENABLE_TRANSACTIONAL_EMAIL=true RESEND_API_KEY=<temporary sending key>
 *   EMAIL_FROM="Marchelo Logistics <notifications@marchelo-logistics.com>"
 *   EMAIL_TEST_RECIPIENT=<test inbox> LIVE_EMAIL_EXPECTED_RECIPIENT=<same inbox>
 *   STAFF_NOTIFICATION_EMAIL=<placeholder staff inbox> LIVE_EMAIL_REPORT=<json path>
 *   npx vitest run --config vitest.live-email.config.mts
 *
 * Fictitious data in a throwaway PostgreSQL (PGlite); real application services,
 * real triggers, the real outbox and the real Resend API. Two guards: the run
 * refuses to start unless the override points at the expected inbox, and the
 * provider wrapper aborts any send that is not to that one address.
 * Customer emails are sent in French and English; staff alerts once each.
 */

const expected = process.env.LIVE_EMAIL_EXPECTED_RECIPIENT?.trim().toLowerCase();
const transport = getEmailTransport();
const guarded = transport.kind === "resend" && !!expected && transport.testRecipient === expected;

type Sent = { step: string; template: string; locale: string; audience: string; intended: string[]; providerId: string; subject: string };
const sent: Sent[] = [];
let t: TestDb;
let db: Database;
let staff: AppUser;
let admin: AppUser;
let real: EmailProvider;
const seenStaff = new Set<string>();
const only = process.env.LIVE_EMAIL_ONLY ? new RegExp(process.env.LIVE_EMAIL_ONLY) : null;
/** `it`, unless LIVE_EMAIL_ONLY limits the run to matching scenario names. */
const live = (name: string, fn: () => Promise<void>) => (only && !only.test(name) ? it.skip : it)(name, fn);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The only provider used for real sends: refuses anything but the one test inbox. */
function guardedProvider(): EmailProvider {
  return {
    async send(input) {
      if (input.to.length !== 1 || input.to[0] !== expected || !input.subject.startsWith("[EMAIL TEST] ")) {
        throw new Error("live email guard: refused a send that is not to the test inbox");
      }
      await sleep(700); // stay under Resend's request rate limit
      return real.send(input);
    },
  };
}

/** Staff alerts are sent once per template and variant; repeats from the second language run are skipped. */
async function dedupeStaff() {
  const rows = (
    await t.client.query<{ id: string; template: string; payload: Record<string, unknown> }>(
      "select id, template, payload from public.email_deliveries where audience = 'staff' and status = 'PENDING'",
    )
  ).rows;
  for (const row of rows) {
    const variant = `${row.template}:${String(row.payload.kind ?? row.payload.reason ?? row.payload.status ?? "")}`;
    if (seenStaff.has(variant)) await t.client.query("update public.email_deliveries set status = 'SKIPPED', error = 'live test: duplicate staff alert' where id = $1", [row.id]);
    else seenStaff.add(variant);
  }
}

/** Sends everything due through the guarded real provider and records what went out. */
async function flush(label: string) {
  await dedupeStaff();
  for (;;) {
    const before = new Set((await t.client.query<{ id: string }>("select id from public.email_deliveries where status = 'SENT'")).rows.map((r) => r.id));
    const report = await processOutbox(db, { transport, provider: guardedProvider(), limit: 25 });
    expect(report.retrying + report.dead, `${label}: provider failures`).toBe(0);
    const rows = (
      await t.client.query<{ id: string; template: string; locale: string; audience: string; provider_message_id: string }>(
        "select id, template, locale::text as locale, audience, provider_message_id from public.email_deliveries where status = 'SENT' order by sent_at",
      )
    ).rows.filter((r) => !before.has(r.id));
    const redirected = [...(report.redirected ?? [])];
    for (const r of rows) {
      const idx = redirected.findIndex((x) => x.template === r.template);
      const intended = idx >= 0 ? redirected.splice(idx, 1)[0].intended : [];
      sent.push({ step: label, template: r.template, locale: r.locale, audience: r.audience, intended, providerId: r.provider_message_id, subject: "" });
    }
    if (report.claimed === 0) break;
  }
}

async function customerUser(email: string, name: string) {
  const u = await createUser(t.client, email, "customer", name);
  return (await loadAppUser(db, u.id, email))!;
}

async function submit(locale: "en" | "fr", user: AppUser | null, email: string, name: string) {
  const r = await submitQuoteRequest(
    db,
    {
      service: "barrels",
      originCountry: locale === "fr" ? "CM" : "IE",
      destinationCountry: locale === "fr" ? "IE" : "CM",
      destinationCity: locale === "fr" ? "Dublin" : "Douala",
      items: [{ description: "Barrel of household goods (test data)", quantity: "2" }],
      contact: { name, email, phone: "+353 89 000 0000" },
      locale,
      idempotencyKey: randomUUID(),
      privacyAccepted: true,
      website: "",
    },
    { user, clientId: randomUUID() },
    { available: true },
  );
  if (!r.ok) throw new Error("submit failed: " + r.code);
  return r;
}

const lines = [
  { kind: "charge", description: "Barrel (220 L), sea freight (test data)", quantity: "2", unitPrice: "150.00" },
  { kind: "charge", description: "Collection (test data)", quantity: "1", unitPrice: "25.00" },
  { kind: "discount", description: "Test discount", quantity: "1", unitPrice: "10.00" },
];

beforeAll(async () => {
  if (!guarded) return;
  real = resendProvider((transport as { apiKey: string }).apiKey);
  process.env.QUOTE_LINK_SECRET ??= randomUUID() + randomUUID();
  t = await createTestDb();
  db = t.db as unknown as Database;
  const s = await createUser(t.client, "live.staff@example.test", "staff", "Test Staff");
  const a = await createUser(t.client, "live.admin@example.test", "admin", "Test Admin");
  staff = (await loadAppUser(db, s.id, "live.staff@example.test"))!;
  admin = (await loadAppUser(db, a.id, "live.admin@example.test"))!;
});
afterAll(async () => {
  if (process.env.LIVE_EMAIL_REPORT) writeFileSync(process.env.LIVE_EMAIL_REPORT, JSON.stringify(sent, null, 1));
  await t?.close();
});

describe.skipIf(!guarded)("live email scenarios (every message to the single test inbox)", () => {
  for (const locale of ["fr", "en"] as const) {
    live(`full quote and shipment lifecycle (${locale})`, async () => {
      const email = `live.${locale}.${randomUUID().slice(0, 6)}@example.test`;
      const user = await customerUser(email, locale === "fr" ? "Client Test" : "Test Customer");
      const r = await submit(locale, user, email, locale === "fr" ? "Client Test" : "Test Customer");
      await flush(`${locale}: request received`);
      await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
      await flush(`${locale}: under review`);
      await requestInformation(db, staff, { requestId: r.requestId, body: "Please confirm the size of each barrel (test data)." });
      await flush(`${locale}: information requested`);
      expect((await addCustomerReply(db, user, r.reference, "Each barrel is 220 litres (test data).")).ok).toBe(true);
      await flush(`${locale}: customer reply`);
      await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
      await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(14), inclusions: "Port handling (test data)", exclusions: "Customs duties (test data)", lines });
      await flush(`${locale}: quote issued`);
      await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
      await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(14), lines: lines.slice(0, 2) });
      await flush(`${locale}: quote updated`);
      expect((await replyViaLink(db, createQuoteToken(r.reference)!, "Question about collection (test data).", randomUUID())).ok).toBe(true);
      await flush(`${locale}: reply via secure link`);
      expect((await respondViaLink(db, createQuoteToken(r.reference)!, true, randomUUID())).ok).toBe(true);
      await flush(`${locale}: quote accepted`);
      // Idempotency: accepting again is refused and sends nothing.
      expect((await respondViaLink(db, createQuoteToken(r.reference)!, true, randomUUID())).ok).toBe(false);
      const sh = await createShipmentForRequest(db, staff, r.requestId);
      if (!sh.ok) throw new Error(sh.code);
      const shipmentId = (await t.client.query<{ id: string }>("select id from public.shipments where reference = $1", [sh.data!.reference])).rows[0].id;
      await flush(`${locale}: shipment confirmed`);
      await addShipmentEvent(db, staff, { shipmentId, milestone: "DEPARTED_ORIGIN", occurredAt: new Date().toISOString(), public: true, location: locale === "fr" ? "Douala" : "Dublin" });
      await flush(`${locale}: shipment update`);
      expect((await updateShipment(db, staff, { shipmentId, status: "ON_HOLD", etaVisible: false })).ok).toBe(true);
      await flush(`${locale}: shipment on hold`);
      expect((await updateShipment(db, staff, { shipmentId, status: "IN_TRANSIT", etaVisible: false })).ok).toBe(true);
      await addShipmentEvent(db, staff, { shipmentId, milestone: "DELAYED", occurredAt: new Date().toISOString(), public: false });
      await flush(`${locale}: shipment delayed`);
      expect((await reportShipmentIssue(db, user, sh.data!.reference, "One barrel looks damaged (test data).")).ok).toBe(true);
      await flush(`${locale}: issue reported`);
      await addShipmentEvent(db, staff, { shipmentId, milestone: "DELIVERED", occurredAt: new Date().toISOString(), public: true, location: locale === "fr" ? "Dublin" : "Douala" });
      await flush(`${locale}: delivered`);
    });

    live(`declined quote (${locale})`, async () => {
      const email = `live.declined.${locale}.${randomUUID().slice(0, 6)}@example.test`;
      const r = await submit(locale, null, email, "Test Declined");
      await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
      await issueQuote(db, staff, { requestId: r.requestId, currency: "XAF", validUntil: inDays(30), lines: [{ kind: "charge", description: "Carton (test data)", quantity: "3", unitPrice: "15000" }] });
      // These three were already sent in the lifecycle run: skip, only the decline matters here.
      await t.client.query("update public.email_deliveries set status = 'SKIPPED', error = 'live test: already covered' where entity_id in ($1, (select id::text from public.quotes where quote_request_id = $2)) and status = 'PENDING'", [r.requestId, r.requestId]);
      expect((await respondViaLink(db, createQuoteToken(r.reference)!, false, randomUUID())).ok).toBe(true);
      await flush(`${locale}: quote declined`);
    });

    live(`expiry reminder and expired quote (${locale})`, async () => {
      const email = `live.expiry.${locale}.${randomUUID().slice(0, 6)}@example.test`;
      const r = await submit(locale, null, email, "Test Expiry");
      await transitionQuoteRequest(db, staff, { requestId: r.requestId, to: "UNDER_REVIEW" });
      await issueQuote(db, staff, { requestId: r.requestId, currency: "EUR", validUntil: inDays(1), lines: [{ kind: "charge", description: "Parcel (test data)", quantity: "1", unitPrice: "40" }] });
      await t.client.query("update public.email_deliveries set status = 'SKIPPED', error = 'live test: already covered' where entity_id in ($1, (select id::text from public.quotes where quote_request_id = $2)) and status = 'PENDING'", [r.requestId, r.requestId]);
      // The reminder job is implemented but off in config/owner.ts; it is exercised here with 48 hours.
      expect((await queueExpiryReminders(db, 48)).reminders).toBeGreaterThanOrEqual(1);
      await flush(`${locale}: expiry reminder`);
      await t.client.exec(`begin; alter table public.quotes disable trigger quotes_rules; update public.quotes set created_at = now() - interval '3 days', valid_until = now() - interval '1 hour' where quote_request_id = '${r.requestId}'; alter table public.quotes enable trigger quotes_rules; commit;`);
      expect((await expireQuotes(db)).expired).toBeGreaterThanOrEqual(1);
      await flush(`${locale}: quote expired`);
    });

    live(`contact enquiry (${locale})`, async () => {
      const res = await submitContactEnquiry(
        db,
        { name: "Test Contact", email: `live.contact.${locale}.${randomUUID().slice(0, 6)}@example.test`, topic: "general", message: "Test enquiry from the live email run (test data).", locale, idempotencyKey: randomUUID(), privacyAccepted: true },
        randomUUID(),
      );
      expect(res.ok).toBe(true);
      await flush(`${locale}: contact enquiry`);
    });
  }

  live("role change alert", async () => {
    const u = await createUser(t.client, "live.promoted@example.test", "customer", "Promoted User");
    expect((await setUserRole(db, admin, u.id, "staff")).ok).toBe(true);
    await flush("role changed");
  });

  live("email failure alerts: retry limit reached, bounce and complaint (controlled, nothing customer-facing fails)", async () => {
    // A customer email that the FAKE provider keeps rejecting until the retry limit.
    await submitContactEnquiry(
      db,
      { name: "Test Failure", email: `live.failure.${randomUUID().slice(0, 6)}@example.test`, topic: "general", message: "Controlled failure (test data).", locale: "en", idempotencyKey: randomUUID(), privacyAccepted: true },
      randomUUID(),
    );
    await t.client.query("update public.email_deliveries set status = 'SKIPPED', error = 'live test: already covered' where template = 'staff_contact' and status = 'PENDING'");
    const failing: EmailProvider = { send: async () => ({ error: "controlled test failure" }) };
    const attempts: number[] = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await t.client.query("update public.email_deliveries set next_attempt_at = now() where template = 'contact_received' and status = 'FAILED'");
      const rep = await processOutbox(db, { transport, provider: failing });
      attempts.push(rep.retrying + rep.dead);
    }
    const dead = (await t.client.query<{ status: string; attempts: number }>("select status::text, attempts from public.email_deliveries where error = 'controlled test failure'")).rows[0];
    expect(dead).toEqual({ status: "DEAD", attempts: MAX_ATTEMPTS });
    // No further attempt after the limit.
    await t.client.query("update public.email_deliveries set next_attempt_at = now() where error = 'controlled test failure'");
    expect((await processOutbox(db, { transport, provider: failing })).claimed).toBe(1); // only the staff alert is due
    await t.client.query("update public.email_deliveries set status = 'PENDING' where template = 'staff_email_failure' and status = 'FAILED'");
    await t.client.query("update public.email_deliveries set attempts = 0, next_attempt_at = now() where template = 'staff_email_failure'");
    await flush("email permanently failed (retry limit)");
    // Bounce and complaint events on two emails that really went out.
    const [a, b] = sent.filter((s) => s.audience === "customer").slice(0, 2);
    expect(await applyResendEvent(db, { type: "email.bounced", data: { email_id: a.providerId } })).toBe("applied");
    expect(await applyResendEvent(db, { type: "email.complained", data: { email_id: b.providerId } })).toBe("applied");
    expect(await applyResendEvent(db, { type: "email.complained", data: { email_id: b.providerId } })).toBe("applied"); // replay: no second alert
    await flush("email bounced and complained");
    expect(sent.filter((s) => s.template === "staff_email_failure")).toHaveLength(3);
  });

  live("job failure alert", async () => {
    await runJob(db, "process-emails", async () => Promise.reject(new Error("controlled test failure"))).catch(() => undefined);
    await runJob(db, "process-emails", async () => Promise.reject(new Error("controlled test failure"))).catch(() => undefined); // same day: one alert
    await flush("job failed");
    expect(sent.filter((s) => s.template === "staff_job_failure")).toHaveLength(1);
  });

  live("nothing is sent twice and every template was covered", async () => {
    expect((await processOutbox(db, { transport, provider: guardedProvider() })).claimed).toBe(0);
    expect(new Set(sent.map((s) => s.providerId)).size).toBe(sent.length);
    const customer = new Set(sent.filter((s) => s.audience === "customer").map((s) => `${s.template}/${s.locale}`));
    for (const tpl of ["quote_received", "quote_under_review", "info_requested", "quote_issued", "quote_updated", "quote_expiring", "quote_expired", "quote_accepted", "quote_declined", "shipment_confirmed", "shipment_update", "shipment_delivered", "contact_received"]) {
      for (const locale of ["en", "fr"]) expect(customer.has(`${tpl}/${locale}`), `${tpl}/${locale}`).toBe(true);
    }
    const staffTemplates = new Set(sent.filter((s) => s.audience === "staff").map((s) => s.template));
    for (const tpl of ["staff_new_request", "staff_customer_message", "staff_quote_accepted", "staff_quote_declined", "staff_shipment_exception", "staff_contact", "staff_role_changed", "staff_email_failure", "staff_job_failure"]) {
      expect(staffTemplates.has(tpl), tpl).toBe(true);
    }
  });
});

describe.skipIf(guarded)("live email scenarios", () => {
  it("are skipped: EMAIL_TEST_RECIPIENT is not active or does not match LIVE_EMAIL_EXPECTED_RECIPIENT", () => {
    expect(guarded).toBe(false);
  });
});
