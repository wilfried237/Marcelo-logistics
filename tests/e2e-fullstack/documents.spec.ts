import { expect, test, type Page, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createLocalShipment, localQuery, resetLocalLoginLimits } from "./local-db";
import { MAX_DOCUMENT_BYTES, UPLOAD_REQUEST_MAX_BYTES, VERCEL_REQUEST_BODY_LIMIT_BYTES } from "../../lib/config/upload-limits";

/*
 * Stage 6: document uploads through a real browser, against the production build
 * and the REAL local Supabase stack (database and private Storage bucket).
 * ENABLE_DOCUMENT_UPLOADS is switched on ONLY in this local test environment
 * (playwright.fullstack.config.ts); production keeps it off until L-03.
 */

for (const file of [".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}
const url = process.env.SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("Document journeys run only against the local Supabase stack.");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
const STAFF = "demo.staff@example.test";

const owner = { email: `docs.owner.${randomUUID().slice(0, 8)}@example.test`, password: `Owner-${randomUUID()}`, id: "" };
const other = { email: `docs.other.${randomUUID().slice(0, 8)}@example.test`, password: `Other-${randomUUID()}`, id: "" };
const fixture = { shipmentRef: "", requestRef: "" };
export const measured: { bytes?: number } = {};

/** A file of exactly `size` bytes that starts with a real PDF header (the server checks content, not names). */
const pdf = (size: number) => {
  const bytes = Buffer.alloc(size, 0x20);
  Buffer.from("%PDF-1.7\n").copy(bytes);
  return bytes;
};

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/en/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/en\/(portal|admin)/);
}

/** Upload requests (POST /api/documents) seen by the browser. */
const isUploadPost = (r: Request) => r.method() === "POST" && new URL(r.url()).pathname === "/api/documents";

test.describe.serial("Stage 6 documents", () => {
  test.beforeEach(async () => resetLocalLoginLimits());
  test.beforeAll(async () => {
    for (const person of [owner, other]) {
      const { data, error } = await admin.auth.admin.createUser({ email: person.email, password: person.password, email_confirm: true, user_metadata: { full_name: "Documents Journey", locale: "en" } });
      if (error || !data.user) throw new Error(`could not create the local test user: ${error?.message}`);
      person.id = data.user.id;
    }
    Object.assign(fixture, await createLocalShipment(owner.id, STAFF));
  });
  test.afterAll(async () => {
    await resetLocalLoginLimits();
    for (const person of [owner, other]) if (person.id) await admin.auth.admin.deleteUser(person.id).catch(() => undefined);
  });

  test("a customer uploads a 4 MB PDF through the browser; the request fits the upload route and Vercel limits", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/en/portal/documents");
    await expect(page.getByLabel("File (PDF, JPG or PNG, up to 4 MB)")).toBeVisible();
    await page.getByLabel("Attach to").selectOption({ label: fixture.requestRef });
    const posts: Request[] = [];
    page.on("request", (r) => {
      if (isUploadPost(r)) posts.push(r);
    });
    await page.getByLabel("File (PDF, JPG or PNG, up to 4 MB)").setInputFiles({ name: "exactly-4mb.pdf", mimeType: "application/pdf", buffer: pdf(MAX_DOCUMENT_BYTES) });
    await page.getByRole("button", { name: "Upload a document" }).click();
    await expect(page.getByText("Document uploaded.")).toBeVisible({ timeout: 30_000 });

    // The real request: the 4 MB file plus multipart framing and the other fields.
    // Chrome does not expose multipart file bodies to the test; the Content-Length it actually sent is the body size.
    const sizes = await Promise.all(posts.map(async (r) => Number((await r.allHeaders())["content-length"] ?? 0)));
    const body = sizes.find((n) => n >= MAX_DOCUMENT_BYTES);
    expect(body, `upload request seen (POST bodies: ${sizes.join(", ") || "none"})`).toBeDefined();
    measured.bytes = body;
    test.info().annotations.push({ type: "upload request body", description: `${body} bytes for a ${MAX_DOCUMENT_BYTES}-byte file (overhead ${body! - MAX_DOCUMENT_BYTES} bytes)` });
    console.log(`[documents] upload request body: ${body} bytes for a ${MAX_DOCUMENT_BYTES}-byte file (overhead ${body! - MAX_DOCUMENT_BYTES} bytes)`);
    expect(body!).toBeLessThanOrEqual(UPLOAD_REQUEST_MAX_BYTES);
    expect(body!).toBeLessThan(VERCEL_REQUEST_BODY_LIMIT_BYTES);

    // The stored file is complete: download it through the private, signed route.
    await page.reload();
    const link = page.locator("main").getByRole("link", { name: /Download.*exactly-4mb\.pdf/ }).first();
    const href = (await link.getAttribute("href"))!;
    const download = await page.request.get(href);
    expect(download.ok()).toBe(true);
    expect((await download.body()).byteLength).toBe(MAX_DOCUMENT_BYTES);
  });

  test("JPEG and PNG files are accepted; anything over 4 MB never leaves the browser", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/en/portal/documents");
    const input = page.getByLabel(/File \(PDF, JPG or PNG/);
    for (const [name, mimeType, header] of [
      ["photo.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
      ["scan.png", "image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ] as const) {
      const buffer = Buffer.alloc(200 * 1024);
      header.copy(buffer);
      await page.getByLabel("Attach to").selectOption({ label: fixture.shipmentRef });
      await input.setInputFiles({ name, mimeType, buffer });
      await page.getByRole("button", { name: "Upload a document" }).click();
      await expect(page.getByText("Document uploaded.")).toBeVisible();
      await page.reload();
    }

    const posts: Request[] = [];
    page.on("request", (r) => {
      if (isUploadPost(r)) posts.push(r);
    });
    await input.setInputFiles({ name: "too-big.pdf", mimeType: "application/pdf", buffer: pdf(MAX_DOCUMENT_BYTES + 1) });
    await expect(page.getByText("The file is larger than 4 MB.")).toBeVisible();
    expect(await input.evaluate((el: HTMLInputElement) => el.files?.length ?? 0)).toBe(0);
    // Submitting now (the large file was removed) asks for a file and sends nothing.
    await page.getByRole("button", { name: "Upload a document" }).click();
    await expect(page.getByText("Choose a file to upload.")).toBeVisible();
    expect(posts).toHaveLength(0);
  });

  test("bypassing the browser check: the route refuses a file over 4 MB and an oversized request body with 413", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/en/portal/documents");
    await page.getByLabel("Attach to").selectOption({ label: fixture.requestRef });
    // Put the file in the input without the change event the form listens to.
    const place = (size: number) =>
      page.locator("input[type=file]").evaluate((el: HTMLInputElement, n: number) => {
        const bytes = new Uint8Array(n).fill(0x20);
        bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], "bypass.pdf", { type: "application/pdf" }));
        el.files = transfer.files;
      }, size);

    await place(MAX_DOCUMENT_BYTES + 1);
    await page.getByRole("button", { name: "Upload a document" }).click();
    await expect(page.getByText("The file is larger than 4 MB.")).toBeVisible({ timeout: 30_000 });

    const responses: number[] = [];
    page.on("response", (r) => {
      if (isUploadPost(r.request())) responses.push(r.status());
    });
    await page.goto("/en/portal/documents");
    await page.getByLabel("Attach to").selectOption({ label: fixture.requestRef });
    await place(5 * 1024 * 1024);
    await page.getByRole("button", { name: "Upload a document" }).click();
    await expect.poll(() => responses.length, { timeout: 30_000 }).toBeGreaterThan(0);
    // The 5 MB body declares its Content-Length, so the route answers 413 before reading it.
    expect(responses[0]).toBe(413);
    await expect(page.getByText("The file is larger than 4 MB.")).toBeVisible();
    await page.goto("/en/portal/documents");
    await expect(page.locator("main").getByText("bypass.pdf")).toHaveCount(0);
  });

  test("another customer cannot download the document; a signed-out visitor cannot either", async ({ page, browser }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/en/portal/documents");
    const href = (await page.locator("main").getByRole("link", { name: /Download.*exactly-4mb\.pdf/ }).first().getAttribute("href"))!;
    await page.context().clearCookies();
    await signIn(page, other.email, other.password);
    expect((await page.request.get(href, { maxRedirects: 0 })).status()).toBe(404);
    await page.goto("/en/portal/documents");
    await expect(page.locator("main").getByText("exactly-4mb.pdf")).toHaveCount(0);
    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(href, { maxRedirects: 0 })).status()).toBe(401);
    await anonymous.close();
  });

  test("direct requests to the upload route: unauthenticated, cross-site, malformed, wrong type, foreign record, oversized", async ({ page, browser, baseURL }) => {
    const [request] = await localQuery<{ id: string }>("select id::text from public.quote_requests where reference = $1", [fixture.requestRef]);
    const file = (size: number, name = "direct.pdf") => ({ name, mimeType: "application/pdf", buffer: pdf(size) });
    const post = (api: typeof page.request, multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>, headers: Record<string, string> = { origin: baseURL! }) =>
      api.post("/api/documents", { multipart, headers });

    const anonymous = await browser.newContext();
    const signedOut = await post(anonymous.request, { ownerType: "quote_request", ownerId: request.id, file: file(1000) });
    expect([signedOut.status(), (await signedOut.json()).code]).toEqual([401, "UNAUTHENTICATED"]);
    await anonymous.close();

    await signIn(page, other.email, other.password);
    const foreign = await post(page.request, { ownerType: "quote_request", ownerId: request.id, file: file(1000) });
    expect([foreign.status(), (await foreign.json()).code]).toEqual([404, "NOT_FOUND"]);
    const crossSite = await post(page.request, { ownerType: "quote_request", ownerId: request.id, file: file(1000) }, { origin: "https://evil.example" });
    expect(crossSite.status()).toBe(403);

    await page.context().clearCookies();
    await signIn(page, owner.email, owner.password);
    const malformed = await post(page.request, { ownerType: "invoice", ownerId: "x", file: file(10) });
    expect([malformed.status(), (await malformed.json()).code]).toEqual([400, "MALFORMED"]);
    const exe = await post(page.request, { ownerType: "quote_request", ownerId: request.id, file: { name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]) } });
    expect([exe.status(), (await exe.json()).code]).toEqual([415, "TYPE"]);
    const exact = await post(page.request, { ownerType: "quote_request", ownerId: request.id, file: file(MAX_DOCUMENT_BYTES, "direct-exact.pdf") });
    expect(exact.status()).toBe(201);
    const over = await post(page.request, { ownerType: "quote_request", ownerId: request.id, file: file(MAX_DOCUMENT_BYTES + 1) });
    expect([over.status(), (await over.json()).code]).toEqual([413, "TOO_LARGE"]);
    const huge = await post(page.request, { ownerType: "quote_request", ownerId: request.id, file: file(6 * 1024 * 1024) });
    expect([huge.status(), (await huge.json()).code]).toEqual([413, "TOO_LARGE"]);
    const stored = await localQuery<{ n: number }>("select count(*)::int n from public.documents where owner_id = $1::uuid and original_name like 'direct%'", [request.id]);
    expect(stored[0].n).toBe(1); // only the exact 4 MiB file
  });

  test("the customer sees each record's documents on its own page; another customer sees none of them", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto(`/en/portal/quotes/${fixture.requestRef}`);
    const quoteDocs = page.locator("section", { has: page.getByRole("heading", { name: "Documents" }) });
    await expect(quoteDocs.getByText("exactly-4mb.pdf", { exact: true })).toBeVisible();
    await expect(quoteDocs.getByText("Added by you").first()).toBeVisible();
    await expect(quoteDocs.getByText("photo.jpg", { exact: true })).toHaveCount(0); // attached to the shipment, not the request
    await page.goto(`/fr/portal/shipments/${fixture.shipmentRef}`);
    const shipmentDocs = page.locator("section", { has: page.getByRole("heading", { name: "Documents" }) });
    await expect(shipmentDocs.getByText("photo.jpg", { exact: true })).toBeVisible();
    await expect(shipmentDocs.getByText("Ajouté par vous").first()).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, other.email, other.password);
    expect((await page.goto(`/en/portal/quotes/${fixture.requestRef}`))?.status()).toBe(404);
    expect((await page.goto(`/en/portal/shipments/${fixture.shipmentRef}`))?.status()).toBe(404);
  });

  test("staff see the customer's documents on the quote and shipment pages and can download them", async ({ page }) => {
    await signIn(page, STAFF, process.env.SEED_USER_PASSWORD ?? "local-only-demo-password");
    await page.goto(`/en/admin/quotes/${fixture.requestRef}`);
    const quoteDocs = page.locator("section", { has: page.getByRole("heading", { name: "Documents" }) });
    await expect(quoteDocs.getByText("exactly-4mb.pdf", { exact: true })).toBeVisible();
    await expect(quoteDocs.getByText("Uploaded by the customer").first()).toBeVisible();
    const href = (await quoteDocs.getByRole("link", { name: /Download.*exactly-4mb\.pdf/ }).first().getAttribute("href"))!;
    const download = await page.request.get(href);
    expect(download.ok()).toBe(true);
    expect((await download.body()).byteLength).toBe(MAX_DOCUMENT_BYTES);
    await page.goto(`/en/admin/shipments/${fixture.shipmentRef}`);
    const shipmentDocs = page.locator("section", { has: page.getByRole("heading", { name: "Documents" }) });
    await expect(shipmentDocs.getByText("photo.jpg", { exact: true })).toBeVisible();
    await expect(shipmentDocs.getByText("scan.png", { exact: true })).toBeVisible();
  });

  test("staff upload a document to the shipment; the customer sees it as added by the business", async ({ page }) => {
    await signIn(page, STAFF, process.env.SEED_USER_PASSWORD ?? "local-only-demo-password");
    await page.goto(`/en/admin/shipments/${fixture.shipmentRef}`);
    const docs = page.locator("section", { has: page.getByRole("heading", { name: "Documents" }) });
    await docs.getByLabel("File (PDF, JPG or PNG, up to 4 MB)").setInputFiles({ name: "delivery-note.pdf", mimeType: "application/pdf", buffer: pdf(50 * 1024) });
    await docs.getByRole("button", { name: "Upload a document" }).click();
    await expect(page.getByText("Document uploaded.")).toBeVisible();
    await page.reload();
    await expect(docs.getByText("delivery-note.pdf", { exact: true })).toBeVisible();
    await expect(docs.getByText(/Uploaded by (?!the customer)/).first()).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, owner.email, owner.password);
    await page.goto(`/en/portal/shipments/${fixture.shipmentRef}`);
    const mine = page.locator("section", { has: page.getByRole("heading", { name: "Documents" }) });
    await expect(mine.getByText("delivery-note.pdf", { exact: true })).toBeVisible();
    await expect(mine.getByText("Added by Marchelo Logistics")).toBeVisible();
  });

  test("each customer upload queued exactly one staff alert, sent through the email provider; the staff upload queued none", async ({ request }) => {
    type Row = { original_name: string; uploaded_by: string; alerts: number; statuses: string[] };
    const rows = await localQuery<Row>(
      `select d.original_name, d.uploaded_by::text,
              (select count(*)::int from public.email_deliveries e where e.template = 'staff_document_uploaded' and e.entity_id = d.id::text) as alerts,
              (select array_agg(e.status::text) from public.email_deliveries e where e.template = 'staff_document_uploaded' and e.entity_id = d.id::text) as statuses
         from public.documents d join public.customers c on c.id = d.customer_id
        where c.user_id = $1`,
      [owner.id],
    );
    const byName = Object.fromEntries(rows.map((r) => [r.original_name, r]));
    for (const name of ["exactly-4mb.pdf", "photo.jpg", "scan.png", "direct-exact.pdf"]) expect(byName[name]?.alerts, name).toBe(1);
    const customerUploads = rows.filter((r) => r.uploaded_by === owner.id).length;
    expect(customerUploads).toBe(4);
    expect(byName["delivery-note.pdf"]?.alerts).toBe(0);
    // Sent through the (local mock) provider. The immediate send after an upload takes the 10 oldest due emails,
    // and earlier local suites leave unsent rows behind, so the authenticated email job drains the queue here.
    const sent = async () =>
      (await localQuery<{ n: number }>("select count(*)::int n from public.email_deliveries e join public.documents d on d.id::text = e.entity_id join public.customers c on c.id = d.customer_id where e.template = 'staff_document_uploaded' and c.user_id = $1 and e.status = 'SENT'", [owner.id]))[0].n;
    for (let i = 0; i < 10 && (await sent()) < customerUploads; i++) {
      const run = await request.get("/api/cron/process-emails", { headers: { authorization: "Bearer journeys-local-cron-secret-0123456789abcdef" /* local test secret, as in journeys.spec.ts */ } });
      expect(run.status()).toBe(200);
    }
    expect(await sent()).toBe(customerUploads);
    // The alert never carries the file name.
    const subjects = await localQuery<{ n: number }>("select count(*)::int n from public.email_deliveries where template = 'staff_document_uploaded' and payload::text like '%.pdf%'");
    expect(subjects[0].n).toBe(0);
  });
});
