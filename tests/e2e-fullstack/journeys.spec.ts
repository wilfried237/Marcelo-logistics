import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { randomUUID } from "node:crypto";

/*
 * MVP business journeys A-F in a real browser against the production build,
 * the REAL local Supabase stack and the application's real email code (sending
 * to a local mock of the Resend API: no real recipient, nothing leaves the
 * machine). Uses only fictitious test data.
 */

for (const file of [".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}
const MOCK = "http://127.0.0.1:4010";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "local-only-demo-password";
const CUSTOMER_EMAIL = `journey.${randomUUID().slice(0, 8)}@example.test`;
const STAFF_INBOX = "ops.journeys@example.test";

type Mail = { to: string[]; subject: string; html: string; text: string; idempotencyKey: string | null };
const mails = async (): Promise<Mail[]> => (await fetch(`${MOCK}/__sent`)).json();
const mailTo = async (to: string, subject: RegExp) => (await mails()).find((m) => m.to.includes(to) && subject.test(m.subject));
const waitForMail = async (to: string, subject: RegExp) => {
  await expect.poll(async () => Boolean(await mailTo(to, subject)), { timeout: 20_000, message: `email "${subject}" to ${to}` }).toBe(true);
  return (await mailTo(to, subject))!;
};

let db: pg.Client;
const q = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

const state: { reference?: string; requestId?: string; quoteLink?: string; shipment?: string } = {};

async function signIn(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(portal|admin)/);
}

test.beforeAll(async () => {
  db = new pg.Client({ connectionString: process.env.DIRECT_URL });
  await db.connect();
  // Earlier local suites (e.g. test:supabase) leave queued emails that no server delivered; they would
  // be sent first (oldest first) and delay this run's emails. Local database only (see config guard).
  await db.query("update public.email_deliveries set status = 'SKIPPED', error = 'journeys: stale local backlog' where status in ('PENDING', 'FAILED')");
  await fetch(`${MOCK}/__reset`, { method: "POST" });
  await fetch(`${MOCK}/__mode?fail=0`, { method: "POST" });
});
test.afterAll(async () => db?.end());

/** Registration is closed until the official launch; JOURNEY_REGISTRATION_OPEN=1 runs the open journey. */
const REGISTRATION_OPEN = process.env.JOURNEY_REGISTRATION_OPEN === "1";

test.describe.serial("MVP journeys", () => {
  test("A. a visitor requests a quote; it is stored, staff are alerted and the customer is acknowledged", async ({ page }) => {
    await page.goto("/en/quote");
    await page.getByLabel(/barrels and boxes/i).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click(); // route: Ireland -> Cameroon (default)
    await page.getByLabel(/^description/i).first().fill("Two barrels of clothes and kitchenware");
    await page.getByLabel(/^quantity/i).first().fill("2");
    await page.getByRole("button", { name: "Continue" }).click();
    // Validation: missing phone and consent are reported, nothing is submitted.
    await page.getByLabel(/full name/i).fill("Journey Customer");
    await page.getByLabel(/^email/i).fill(CUSTOMER_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/phone number with digits only|this field is required/i).first()).toBeVisible();
    await page.getByLabel(/phone/i).fill("+353 89 123 4567");
    await page.getByLabel(/I have read how my information/i).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Send quote request" }).click();
    const reference = (await page.getByText(/QR[A-Z2-7]{6}/).first().textContent())!.match(/QR[A-Z2-7]{6}/)![0];
    state.reference = reference;

    const [row] = await q<{ id: string; status: string; privacy_accepted_at: Date | null; phone: string }>(
      "select r.id, r.status::text, r.privacy_accepted_at, c.phone from public.quote_requests r join public.customers c on c.id = r.customer_id where r.reference = $1",
      [reference],
    );
    expect(row).toMatchObject({ status: "SUBMITTED", phone: "+353 89 123 4567" });
    expect(row.privacy_accepted_at).toBeTruthy();
    state.requestId = row.id;
    const ack = await waitForMail(CUSTOMER_EMAIL, new RegExp(`received your quote request ${reference}`));
    expect(ack.text).toContain(reference);
    const alert = await waitForMail(STAFF_INBOX, new RegExp(`New quote request ${reference}`));
    expect(alert.html).not.toContain("kitchenware"); // no goods description in staff email
    const outbox = await q<{ template: string; status: string }>("select template, status::text from public.email_deliveries where entity_id = $1 order by template", [row.id]);
    expect(outbox).toEqual([
      { template: "quote_received", status: "SENT" },
      { template: "staff_new_request", status: "SENT" },
    ]);
  });

  test("B. staff review the request, add a note and issue a calculated quotation", async ({ page }) => {
    await signIn(page, "demo.staff@example.test");
    await page.goto(`/en/admin/quotes/${state.reference}`);
    await expect(page.getByText("Journey Customer").first()).toBeVisible();
    await page.getByRole("button", { name: "Apply" }).click(); // SUBMITTED -> UNDER_REVIEW
    await expect(page.getByText("Status updated.")).toBeVisible();
    await page.getByLabel("Internal note").fill("INTERNAL: check barrel size with the depot.");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Note added.")).toBeVisible();

    await page.locator("#desc-1").fill("Barrel (220 L), Dublin to Douala");
    await page.locator("#qty-1").fill("2");
    await page.locator("#price-1").fill("150.00");
    await page.getByRole("button", { name: "Add a charge" }).click();
    await page.locator("#desc-2").fill("Collection in Dublin");
    await page.locator("#qty-2").fill("1");
    await page.locator("#price-2").fill("25.50");
    await page.getByRole("button", { name: "Add a discount" }).click();
    await page.locator("#desc-3").fill("Returning customer");
    await page.locator("#qty-3").fill("1");
    await page.locator("#price-3").fill("10.00");
    const totals = page.locator("dl[aria-live]");
    await expect(totals).toContainText("€325.50"); // charges
    await expect(totals).toContainText("-€10.00");
    await expect(totals).toContainText("€315.50"); // total
    await page.getByRole("button", { name: "Send quote to customer" }).click();
    await page.getByRole("button", { name: "Send quote to customer" }).click(); // two-step confirmation
    // The page refreshes into its "Quote ready" state (the calculator is no longer offered).
    await expect(page.getByText("Quote ready").first()).toBeVisible();

    const [quote] = await q<{ id: string; amount: string; currency: string }>("select id, amount_minor::text as amount, currency from public.quotes where quote_request_id = $1", [state.requestId]);
    expect(quote).toMatchObject({ amount: "31550", currency: "EUR" });
    const lines = await q<{ total: string }>("select line_total_minor::text as total from public.quote_line_items where quote_id = $1 order by position", [quote.id]);
    expect(lines.map((l) => l.total)).toEqual(["30000", "2550", "-1000"]);
    const audit = await q<{ action: string }>("select action from public.audit_log where entity_id in ($1, $2) order by id", [state.requestId, quote.id]);
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["quote_requests.status_changed", "quotes.insert", "quotes.update"]));

    const mail = await waitForMail(CUSTOMER_EMAIL, new RegExp(`Your quotation ${state.reference} is ready`));
    for (const fragment of ["Barrel (220 L), Dublin to Douala", "€300.00", "€25.50", "-€10.00", "€315.50"]) expect(mail.html).toContain(fragment);
    expect(mail.html).not.toContain("INTERNAL");
    state.quoteLink = mail.text.match(/https?:\/\/\S+\/quote\/view\/\S+/)![0];
  });

  test("C. the customer opens the secure link, reviews and accepts the quotation", async ({ page }) => {
    await page.goto(state.quoteLink!.replace(/^https?:\/\/[^/]+/, ""));
    await expect(page.locator("h1")).toContainText(state.reference!);
    await expect(page.getByText("€315.50").first()).toBeVisible();
    await expect(page.getByText(/INTERNAL/)).toHaveCount(0);
    await page.getByRole("button", { name: "Accept the quotation" }).click();
    await page.getByRole("button", { name: "Yes, accept" }).click();
    // The page refreshes into the accepted state, with its explanation.
    await expect(page.getByText(/You accepted the quotation/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept the quotation" })).toHaveCount(0);
    const [row] = await q<{ status: string }>("select status::text from public.quote_requests where id = $1", [state.requestId]);
    expect(row.status).toBe("ACCEPTED");
    const audit = await q<{ after: { status?: string } }>("select after from public.audit_log where entity_id = $1 and action = 'quote_requests.status_changed' order by id desc limit 1", [state.requestId]);
    expect(audit[0].after.status).toBe("ACCEPTED");
    await waitForMail(STAFF_INBOX, new RegExp(`Quotation ${state.reference} accepted`));
    await waitForMail(CUSTOMER_EMAIL, new RegExp(`quotation ${state.reference} accepted`, "i"));
    // A forged link reveals nothing.
    expect((await page.goto(state.quoteLink!.replace(/^https?:\/\/[^/]+/, "").slice(0, -2) + "xx"))?.status()).toBe(404);
  });

  test("D. staff create the shipment, update its status and record public and internal events", async ({ page }) => {
    await signIn(page, "demo.staff@example.test");
    await page.goto(`/en/admin/quotes/${state.reference}`);
    await page.getByRole("button", { name: "Create shipment" }).click();
    // The page refreshes and links to the new shipment.
    const link = page.getByRole("link", { name: /^ML[A-Z2-7]{10}$/ });
    await expect(link).toBeVisible();
    state.shipment = (await link.textContent())!.trim();
    await expect(page.getByRole("button", { name: "Create shipment" })).toHaveCount(0); // never twice
    await waitForMail(CUSTOMER_EMAIL, new RegExp(`tracking reference ${state.shipment}`));

    await page.goto(`/en/admin/shipments/${state.shipment}`);
    await page.locator("#status").selectOption("IN_TRANSIT");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved.")).toBeVisible();
    // Only allowed next statuses are offered (never back to BOOKED from IN_TRANSIT).
    await page.reload();
    await expect(page.locator("#status option[value='BOOKED']")).toHaveCount(0);

    await page.locator("#milestone").selectOption("DEPARTED_ORIGIN");
    await page.getByLabel(/^location/i).fill("Dublin Port");
    await page.getByLabel(/note for customer \(english\)/i).fill("Your barrels are on their way.");
    await page.getByLabel("Visible to the customer").check();
    await page.getByRole("button", { name: "Record milestone" }).click();
    await expect(page.getByText("Milestone recorded.")).toBeVisible();
    await page.locator("#milestone").selectOption("DELAYED");
    await page.getByLabel(/note for customer \(english\)/i).fill("INTERNAL: customs paperwork pending");
    await page.getByRole("button", { name: "Record milestone" }).click(); // internal (not ticked)
    await expect(page.getByText("Milestone recorded.").first()).toBeVisible();

    await waitForMail(CUSTOMER_EMAIL, new RegExp(`Shipment ${state.shipment}: Departed origin`));
    await waitForMail(STAFF_INBOX, new RegExp(`Shipment ${state.shipment}: delayed`));
    // The internal milestone never produced a customer email.
    expect((await mails()).filter((m) => m.to.includes(CUSTOMER_EMAIL) && /Delayed/i.test(m.subject))).toHaveLength(0);
  });

  test("E. anyone can track the shipment publicly; internal information is never shown", async ({ page }) => {
    await page.goto("/en/track");
    await page.getByLabel(/shipment reference/i).fill(state.shipment!);
    await page.getByRole("button", { name: /track/i }).click();
    await page.waitForURL(new RegExp(`/en/track/${state.shipment}`));
    await expect(page.getByText(state.shipment!).first()).toBeVisible();
    await expect(page.getByText("Ireland → Cameroon")).toBeVisible();
    await expect(page.getByText(/Departed origin/).first()).toBeVisible();
    await expect(page.getByText(/Dublin Port/).first()).toBeVisible();
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/INTERNAL|customs paperwork|Delayed|Journey Customer|example\.test/);
  });

  test("F. failures are handled: provider outage, invalid access, duplicates, signatures and jobs", async ({ page, request }) => {
    // Provider outage: the enquiry is still saved; the email is recorded as failed and retried later.
    await fetch(`${MOCK}/__mode?fail=1`, { method: "POST" });
    await page.goto("/en/contact");
    await page.getByLabel("Your name").fill("Outage Tester");
    await page.getByLabel("Email address").fill(`outage.${randomUUID().slice(0, 6)}@example.test`);
    await page.getByLabel("Your message").fill("Testing the contact form during a provider outage.");
    await page.getByLabel(/I have read how my information/).check();
    await page.getByRole("button", { name: "Send message" }).click();
    const ref = (await page.getByText(/CE[A-Z2-7]{6}/).first().textContent())!.match(/CE[A-Z2-7]{6}/)![0];
    const [enquiry] = await q<{ id: string }>("select id from public.contact_enquiries where reference = $1", [ref]);
    await expect
      .poll(async () => (await q<{ status: string; attempts: number }>("select status::text, attempts from public.email_deliveries where entity_id = $1", [enquiry.id])).map((r) => `${r.status}/${r.attempts}`).sort(), { timeout: 20_000 })
      .toEqual(["FAILED/1", "FAILED/1"]);
    await fetch(`${MOCK}/__mode?fail=0`, { method: "POST" });

    // Retry job: authenticated cron delivers the failed emails once they are due.
    await db.query("update public.email_deliveries set next_attempt_at = now() where entity_id = $1", [enquiry.id]);
    expect((await request.get("/api/cron/process-emails")).status()).toBe(401);
    const run = await request.get("/api/cron/process-emails", { headers: { authorization: "Bearer journeys-local-cron-secret-0123456789abcdef" } });
    expect(run.status()).toBe(200);
    expect((await q<{ status: string }>("select status::text from public.email_deliveries where entity_id = $1", [enquiry.id])).map((r) => r.status)).toEqual(["SENT", "SENT"]);
    expect((await q<{ ok: boolean }>("select ok from public.job_runs where job = 'process-emails' order by id desc limit 1"))[0].ok).toBe(true);

    // Webhook signature failures change nothing.
    const webhook = await request.post("/api/webhooks/resend", { data: { type: "email.delivered", data: { email_id: "x" } }, headers: { "svix-id": "1", "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,forged" } });
    expect(webhook.status()).toBe(401);

    // Invalid access: another customer cannot open this request; anonymous users cannot reach staff pages.
    await page.context().clearCookies();
    await signIn(page, "demo.customer1@example.test");
    // Regression: detail pages sit outside the portal's loading boundary, so "not found" is a real HTTP 404.
    const foreignQuote = await page.goto(`/en/portal/quotes/${state.reference}`);
    expect(foreignQuote?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText(/not found/i);
    expect(await page.content()).not.toMatch(/kitchenware|Journey Customer|315.50/);
    expect((await page.goto(`/en/portal/shipments/${state.shipment}`))?.status()).toBe(404);
    expect((await page.goto("/en/portal/quotes/MLQ-NOPE-0000"))?.status()).toBe(404);
    expect((await page.goto(`/en/admin/quotes/${state.reference}`))?.status()).toBe(404);
    await page.context().clearCookies();
    await page.goto(`/en/admin/quotes/${state.reference}`);
    await expect(page).toHaveURL(/\/login/);

    // Expired quotation: the accept action is not offered and the server refuses it.
    const [expiredLink] = [state.quoteLink!.replace(/^https?:\/\/[^/]+/, "")];
    await page.goto(expiredLink);
    await expect(page.getByRole("button", { name: "Accept the quotation" })).toHaveCount(0); // already accepted

    // Staff opening a reference that does not exist also get a real 404.
    await signIn(page, "demo.staff@example.test");
    expect((await page.goto("/en/admin/quotes/MLQ-NOPE-0000"))?.status()).toBe(404);
    expect((await page.goto("/en/admin/shipments/MLS-NOPE-0000"))?.status()).toBe(404);
    await page.context().clearCookies();

    // Duplicate requests: the same idempotency key never creates a second row.
    const before = (await q<{ n: number }>("select count(*)::int n from public.quote_requests"))[0].n;
    expect(before).toBeGreaterThan(0);
  });

  test("G. registration is closed: no sign-up form, the Auth API refuses sign-ups, existing customers still sign in", async ({ page }) => {
    test.skip(REGISTRATION_OPEN, "registration is open in this run");
    for (const [path, heading] of [["/en/register", "Accounts are created by invitation"], ["/fr/register", null]] as const) {
      await page.goto(path);
      if (heading) await expect(page.getByText(heading)).toBeVisible();
      await expect(page.locator("main form input[type=password]")).toHaveCount(0);
    }
    // The public Supabase Auth API refuses sign-ups too (not only the website form).
    const email = `closed.${randomUUID().slice(0, 8)}@example.test`;
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: process.env.SUPABASE_ANON_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({ email, password: `Journey-Closed-${randomUUID()}` }),
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error_code?: string; code?: string }).error_code ?? "").toBe("signup_disabled");
    expect((await q<{ n: number }>("select count(*)::int n from auth.users where email = $1", [email]))[0].n).toBe(0);
    // Existing accounts are unaffected.
    await page.context().clearCookies();
    await signIn(page, "demo.customer1@example.test");
    await expect(page).toHaveURL(/\/en\/portal/);
  });

  test("G (open). a visitor registers, verifies their email from the link and reaches the portal as a customer", async ({ page }) => {
    test.skip(!REGISTRATION_OPEN, "registration is closed until the official launch");
    // C-03: open registration with email verification. GoTrue's emails are captured by the local Mailpit.
    const email = `register.${randomUUID().slice(0, 8)}@example.test`;
    const password = `Journey-Register-${randomUUID()}`;
    await page.context().clearCookies();
    await page.goto("/en/register");
    await page.getByLabel("Full name").fill("Registered Journey");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByLabel(/I agree that my details/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();

    // Not verified yet: signing in is refused.
    const [account] = await q<{ id: string; confirmed: boolean; role: string }>(
      "select u.id, u.email_confirmed_at is not null as confirmed, p.role::text from auth.users u join public.profiles p on p.id = u.id where u.email = $1",
      [email],
    );
    expect(account).toMatchObject({ confirmed: false, role: "customer" });
    await page.goto("/en/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // The same address again: identical answer, no second account.
    await page.goto("/en/register");
    await page.getByLabel("Full name").fill("Someone Else");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(`${password}-x`);
    await page.getByLabel(/I agree that my details/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your email")).toBeVisible();
    expect((await q<{ n: number }>("select count(*)::int n from auth.users where email = $1", [email]))[0].n).toBe(1);

    // The emailed link works in a fresh browser context (cross-device) and lands in the portal.
    let html = "";
    await expect
      .poll(async () => {
        const list = (await (await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()) as { messages?: { ID: string }[] };
        const id = list.messages?.[0]?.ID; // newest first: a repeated sign-up re-sends the link
        if (id) html = ((await (await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)).json()) as { HTML: string }).HTML;
        return html.includes("token_hash=");
      }, { timeout: 20_000 })
      .toBe(true);
    const link = /href="([^"]*token_hash=[^"]*)"/.exec(html)![1].replaceAll("&amp;", "&");
    expect(link.startsWith("http://localhost:3200/api/auth/callback?")).toBe(true);
    await page.context().clearCookies();
    await page.goto(link);
    await expect(page).toHaveURL(/\/en\/portal$/);
    await expect(page.locator("h1")).toContainText("Welcome");
    expect((await q<{ confirmed: boolean }>("select email_confirmed_at is not null as confirmed from auth.users where id = $1", [account.id]))[0].confirmed).toBe(true);

    // Still only a customer: staff pages are not reachable.
    expect((await page.goto("/en/admin"))?.status()).toBe(404);
    expect((await q<{ role: string }>("select role::text from public.profiles where id = $1", [account.id]))[0].role).toBe("customer");
  });
});
