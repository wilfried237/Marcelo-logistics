import { expect, test, type Page, type Request } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createLocalShipment, resetLocalLoginLimits } from "./local-db";
import { MAX_DOCUMENT_BYTES, SERVER_ACTION_BODY_LIMIT_BYTES, VERCEL_REQUEST_BODY_LIMIT_BYTES } from "../../lib/config/upload-limits";

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

/** Server Action POSTs (the upload) seen by the browser. */
const isActionPost = (r: Request) => r.method() === "POST" && /\/portal\/documents/.test(r.url());

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

  test("a customer uploads a 4 MB PDF through the browser; the request fits the Server Action and Vercel limits", async ({ page }) => {
    await signIn(page, owner.email, owner.password);
    await page.goto("/en/portal/documents");
    await expect(page.getByLabel("File (PDF, JPG or PNG, up to 4 MB)")).toBeVisible();
    await page.getByLabel("Attach to").selectOption({ label: fixture.requestRef });
    const posts: Request[] = [];
    page.on("request", (r) => {
      if (isActionPost(r)) posts.push(r);
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
    expect(body!).toBeLessThanOrEqual(SERVER_ACTION_BODY_LIMIT_BYTES);
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
      if (isActionPost(r)) posts.push(r);
    });
    await input.setInputFiles({ name: "too-big.pdf", mimeType: "application/pdf", buffer: pdf(MAX_DOCUMENT_BYTES + 1) });
    await expect(page.getByText("The file is larger than 4 MB.")).toBeVisible();
    expect(await input.evaluate((el: HTMLInputElement) => el.files?.length ?? 0)).toBe(0);
    // Submitting now sends an empty form (the large file was removed) and gets a clear answer.
    await page.getByRole("button", { name: "Upload a document" }).click();
    await expect(page.getByText("Choose a file to upload.")).toBeVisible();
    const sent = await Promise.all(posts.map(async (r) => Number((await r.allHeaders())["content-length"] ?? 0)));
    expect(sent.every((n) => n < 64 * 1024), `request bodies: ${sent.join(", ")}`).toBe(true);
  });

  test("bypassing the browser check: the server refuses a file over 4 MB, and Next.js refuses a body over its limit", async ({ page }) => {
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
      if (isActionPost(r.request())) responses.push(r.status());
    });
    await page.goto("/en/portal/documents");
    await page.getByLabel("Attach to").selectOption({ label: fixture.requestRef });
    await place(5 * 1024 * 1024);
    await page.getByRole("button", { name: "Upload a document" }).click();
    await expect.poll(() => responses.length, { timeout: 30_000 }).toBeGreaterThan(0);
    // Next.js 16 refuses the over-limit Server Action body ("Body exceeded 4456448 limit" in the server log)
    // and answers 500 rather than 413. On Vercel, bodies over 4.5 MB are refused before the function runs.
    expect([413, 500]).toContain(responses[0]);
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
});
