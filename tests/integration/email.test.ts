import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { render } from "@react-email/components";
import { createTestDb, type TestDb } from "../db/harness";
import type { Database } from "@/lib/db/types";
import { sendEmail, type EmailProvider } from "@/lib/email/send";
import { QuoteAcknowledgementEmail, QuoteIssuedEmail } from "@/lib/email/templates";

let t: TestDb;
let db: Database;
beforeAll(async () => {
  t = await createTestDb();
  db = t.db as unknown as Database;
});
afterAll(async () => t?.client.close());

const message = (key: string) => ({
  template: "quote_acknowledgement",
  to: "customer@example.test",
  locale: "en" as const,
  subject: "Subject",
  react: createElement(QuoteAcknowledgementEmail, { locale: "en", name: "Ada", reference: "QRABCDEF" }),
  entity: "quote_requests",
  entityId: "00000000-0000-0000-0000-000000000001",
  idempotencyKey: key,
});
const resend = { kind: "resend" as const, apiKey: "re_test", from: "Test <notify@example.test>" };
const status = async (key: string) => (await t.client.query<{ status: string }>("select status from public.email_deliveries where idempotency_key = $1", [key])).rows[0]?.status;

describe("transactional email (mocked provider, no real recipients)", () => {
  it("reports sent only when the provider accepts, and logs the delivery", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({ id: "msg_1" }) };
    expect(await sendEmail(db, message("k1"), { transport: resend, provider })).toBe("sent");
    expect(await status("k1")).toBe("SENT");
  });

  it("is idempotent: the same key is never sent twice", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({ id: "msg_2" }) };
    expect(await sendEmail(db, message("k1"), { transport: resend, provider })).toBe("already_sent");
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("records provider failures without claiming success", async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({ error: "domain not verified" }) };
    expect(await sendEmail(db, message("k2"), { transport: resend, provider })).toBe("failed");
    expect(await status("k2")).toBe("FAILED");
    const thrower: EmailProvider = { send: vi.fn().mockRejectedValue(new Error("network down")) };
    expect(await sendEmail(db, message("k3"), { transport: resend, provider: thrower })).toBe("failed");
  });

  it("skips sending while email is disabled or in dev-log mode", async () => {
    const provider: EmailProvider = { send: vi.fn() };
    expect(await sendEmail(db, message("k4"), { transport: { kind: "disabled", reason: "flag off" }, provider })).toBe("skipped");
    expect(await sendEmail(db, message("k5"), { transport: { kind: "log" }, provider })).toBe("skipped");
    expect(provider.send).not.toHaveBeenCalled();
    expect(await status("k4")).toBe("SKIPPED");
  });

  it("renders English and French templates without owner placeholders", async () => {
    const en = await render(createElement(QuoteIssuedEmail, { locale: "en", name: "Ada", reference: "QRABCDEF", amountMinor: 45050, currency: "EUR", validUntil: new Date("2030-01-01"), url: "https://example.test/x" }));
    const fr = await render(createElement(QuoteIssuedEmail, { locale: "fr", name: "Ada", reference: "QRABCDEF", amountMinor: 45050, currency: "EUR", validUntil: new Date("2030-01-01"), url: "https://example.test/x" }));
    expect(en).toContain("Your quote QRABCDEF is ready");
    expect(fr).toContain("Votre devis QRABCDEF est prêt");
    expect(fr).toMatch(/450,50/);
    expect(en + fr).not.toContain("NEEDS_OWNER");
  });
});
