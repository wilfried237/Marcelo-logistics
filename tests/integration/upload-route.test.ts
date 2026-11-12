import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import { insertRequest } from "../db/fixtures";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import type { DocumentStorage } from "@/lib/services/documents";
import { loadAppUser } from "@/lib/services/users";
import { MAX_DOCUMENT_BYTES, UPLOAD_LIMITS, UPLOAD_REQUEST_MAX_BYTES } from "@/lib/config/upload-limits";

/*
 * Stage 6 (S7): the document upload route handler POST /api/documents, run
 * against PostgreSQL (PGlite, every migration, RLS and triggers). Only the
 * session, the storage bucket, email delivery and the feature switch are
 * replaced; ownership is decided by the real database rules.
 */
const state = vi.hoisted(() => ({ user: null as AppUser | null, uploadsOn: true, db: null as unknown, files: new Map<string, Uint8Array>() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/db/client", async (original) => ({ ...(await original<typeof import("@/lib/db/client")>()), getDb: () => state.db }));
vi.mock("@/lib/email/dispatch", () => ({ deliverQueuedEmailsSoon: () => undefined }));
vi.mock("@/lib/config/env", async (original) => ({ ...(await original<typeof import("@/lib/config/env")>()), documentUploadsAvailable: () => state.uploadsOn }));
vi.mock("@/lib/storage/supabase-storage", () => ({
  supabaseDocumentStorage: (): DocumentStorage => ({
    upload: async (key, bytes) => void state.files.set(key, bytes),
    remove: async (key) => void state.files.delete(key),
    signedUrl: async (key) => `https://storage.example.test/${key}`,
  }),
}));

const { POST } = await import("@/app/api/documents/route");

let t: TestDb;
let customerA: AppUser;
let customerB: AppUser;
let staff: AppUser;
let requestA = "";
let requestB = "";
const ORIGIN = "http://localhost:3200";
const pdf = (size: number) => {
  const bytes = new Uint8Array(size).fill(0x20);
  bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
  return bytes;
};

/** A browser-like multipart upload (no Content-Length: the route reads the stream with its cap). */
function upload(fields: { ownerType?: string; ownerId?: string; file?: Uint8Array | null; name?: string }, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (fields.ownerType !== undefined) form.set("ownerType", fields.ownerType);
  if (fields.ownerId !== undefined) form.set("ownerId", fields.ownerId);
  if (fields.file) form.set("file", new File([fields.file as BlobPart], fields.name ?? "document.pdf", { type: "application/pdf" }));
  return new Request(`${ORIGIN}/api/documents`, { method: "POST", body: form, headers: { origin: ORIGIN, host: "localhost:3200", ...headers } });
}
const send = async (request: Request) => {
  const response = await POST(request as never);
  return { status: response.status, body: (await response.json()) as { code: string; id?: string } };
};
const documents = async () => (await t.client.query<{ n: number }>("select count(*)::int n from public.documents")).rows[0].n;

beforeAll(async () => {
  t = await createTestDb();
  state.db = t.db as unknown as Database;
  const db = state.db as Database;
  const a = await createUser(t.client, "route.a@example.test", "customer", "Route A");
  const b = await createUser(t.client, "route.b@example.test", "customer", "Route B");
  const s = await createUser(t.client, "route.staff@example.test", "staff", "Route Staff");
  customerA = (await loadAppUser(db, a.id, null))!;
  customerB = (await loadAppUser(db, b.id, null))!;
  staff = (await loadAppUser(db, s.id, null))!;
  requestA = await insertRequest(t.client, a.customerId, "QRROUTEA");
  requestB = await insertRequest(t.client, b.customerId, "QRROUTEB");
});
afterAll(async () => t?.close());
beforeEach(async () => {
  state.user = customerA;
  state.uploadsOn = true;
  await t.client.query("delete from public.rate_limits");
});

describe("POST /api/documents", () => {
  it("a customer uploads a file of exactly 4 MiB to their own request; it is stored privately and audited", async () => {
    const before = await documents();
    const result = await send(upload({ ownerType: "quote_request", ownerId: requestA, file: pdf(MAX_DOCUMENT_BYTES), name: "../../etc/passwd.pdf" }));
    expect(result.status).toBe(201);
    expect(result.body.code).toBe("UPLOADED");
    expect(await documents()).toBe(before + 1);
    const [row] = (await t.client.query<{ storage_key: string; original_name: string; size_bytes: number; uploaded_by: string; mime: string }>("select storage_key, original_name, size_bytes, uploaded_by, mime from public.documents where id = $1", [result.body.id])).rows;
    expect(row).toMatchObject({ size_bytes: MAX_DOCUMENT_BYTES, uploaded_by: customerA.id, mime: "application/pdf", original_name: "passwd.pdf" });
    expect(row.storage_key).toMatch(/^[0-9a-f-]{36}\/quote_request\/[0-9a-f-]{36}\.pdf$/);
    expect(state.files.get(row.storage_key)?.byteLength).toBe(MAX_DOCUMENT_BYTES);
    const audit = (await t.client.query<{ actor: string }>("select actor from public.audit_log where entity = 'documents' and entity_id = $1 and action = 'documents.insert'", [result.body.id])).rows;
    expect(audit).toEqual([{ actor: customerA.id }]);
  });

  it("staff upload to any customer's record", async () => {
    state.user = staff;
    const result = await send(upload({ ownerType: "quote_request", ownerId: requestB, file: pdf(1000) }));
    expect(result.status).toBe(201);
    const [row] = (await t.client.query<{ uploaded_by: string }>("select uploaded_by from public.documents where id = $1", [result.body.id])).rows;
    expect(row.uploaded_by).toBe(staff.id);
  });

  it("a customer cannot upload to another customer's record (same answer as a missing one)", async () => {
    const before = await documents();
    expect(await send(upload({ ownerType: "quote_request", ownerId: requestB, file: pdf(1000) }))).toEqual({ status: 404, body: { code: "NOT_FOUND" } });
    state.user = customerB;
    expect(await send(upload({ ownerType: "shipment", ownerId: requestA, file: pdf(1000) }))).toEqual({ status: 404, body: { code: "NOT_FOUND" } });
    expect(await documents()).toBe(before);
  });

  it("refuses unauthenticated requests, and cross-site or origin-less requests, before reading the body", async () => {
    state.user = null;
    expect(await send(upload({ ownerType: "quote_request", ownerId: requestA, file: pdf(1000) }))).toEqual({ status: 401, body: { code: "UNAUTHENTICATED" } });
    state.user = customerA;
    expect(await send(upload({ ownerType: "quote_request", ownerId: requestA, file: pdf(1000) }, { origin: "https://evil.example" }))).toEqual({ status: 403, body: { code: "FORBIDDEN_ORIGIN" } });
    const noOrigin = new Request(`${ORIGIN}/api/documents`, { method: "POST", body: new FormData(), headers: { host: "localhost:3200" } });
    expect(await send(noOrigin)).toEqual({ status: 403, body: { code: "FORBIDDEN_ORIGIN" } });
  });

  it("refuses everyone, staff included, while uploads are switched off", async () => {
    state.uploadsOn = false;
    const before = await documents();
    for (const user of [customerA, staff]) {
      state.user = user;
      expect(await send(upload({ ownerType: "quote_request", ownerId: requestA, file: pdf(1000) }))).toEqual({ status: 403, body: { code: "UPLOADS_DISABLED" } });
    }
    expect(await documents()).toBe(before);
  });

  it("refuses files that are not really PDF, JPEG or PNG, whatever their name or declared type", async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]);
    expect(await send(upload({ ownerType: "quote_request", ownerId: requestA, file: exe, name: "invoice.pdf" }))).toEqual({ status: 415, body: { code: "TYPE" } });
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(await send(upload({ ownerType: "quote_request", ownerId: requestA, file: html, name: "x.png" }))).toEqual({ status: 415, body: { code: "TYPE" } });
  });

  it("refuses a file one byte over 4 MiB, and stores nothing", async () => {
    const before = await documents();
    expect(await send(upload({ ownerType: "quote_request", ownerId: requestA, file: pdf(MAX_DOCUMENT_BYTES + 1) }))).toEqual({ status: 413, body: { code: "TOO_LARGE" } });
    expect(await documents()).toBe(before);
  });

  it("refuses an oversized declared Content-Length without reading the body", async () => {
    let read = false;
    const body = new ReadableStream<Uint8Array>({
      pull() {
        read = true;
        throw new Error("the body must not be read");
      },
    }, { highWaterMark: 0 }); // pulled only when someone actually reads
    const request = new Request(`${ORIGIN}/api/documents`, {
      method: "POST",
      body,
      duplex: "half",
      headers: { origin: ORIGIN, host: "localhost:3200", "content-type": "multipart/form-data; boundary=x", "content-length": String(UPLOAD_REQUEST_MAX_BYTES + 1) },
    } as RequestInit);
    expect(await send(request)).toEqual({ status: 413, body: { code: "TOO_LARGE" } });
    expect(read).toBe(false);
  });

  it("stops reading an oversized body that declares no length (chunked)", async () => {
    let pulled = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        if (pulled > 20) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const request = new Request(`${ORIGIN}/api/documents`, {
      method: "POST",
      body,
      duplex: "half",
      headers: { origin: ORIGIN, host: "localhost:3200", "content-type": "multipart/form-data; boundary=x" },
    } as RequestInit);
    expect(await send(request)).toEqual({ status: 413, body: { code: "TOO_LARGE" } });
    expect(pulled).toBeLessThanOrEqual(7); // about 4 MiB read, never the full 20 MiB
  });

  it("refuses malformed requests", async () => {
    const json = new Request(`${ORIGIN}/api/documents`, { method: "POST", body: "{}", headers: { origin: ORIGIN, host: "localhost:3200", "content-type": "application/json" } });
    expect(await send(json)).toEqual({ status: 415, body: { code: "UNSUPPORTED_MEDIA_TYPE" } });
    const broken = new Request(`${ORIGIN}/api/documents`, { method: "POST", body: "not multipart at all", headers: { origin: ORIGIN, host: "localhost:3200", "content-type": "multipart/form-data; boundary=zzz" } });
    expect(await send(broken)).toEqual({ status: 400, body: { code: "MALFORMED" } });
    const badLength = new Request(`${ORIGIN}/api/documents`, { method: "POST", body: "x", headers: { origin: ORIGIN, host: "localhost:3200", "content-type": "multipart/form-data; boundary=zzz", "content-length": "abc" } });
    expect((await send(badLength)).status).toBeGreaterThanOrEqual(400);
    for (const fields of [
      { ownerType: "invoice", ownerId: requestA, file: pdf(10) },
      { ownerType: "quote_request", ownerId: "not-a-uuid", file: pdf(10) },
      { ownerType: "quote_request", ownerId: "' or 1=1 --", file: pdf(10) },
      { ownerType: "quote_request", ownerId: requestA },
      { ownerId: requestA, file: pdf(10) },
    ]) {
      expect(await send(upload(fields)), JSON.stringify({ ...fields, file: !!fields.file })).toEqual({ status: 400, body: { code: "MALFORMED" } });
    }
    expect(await send(upload({ ownerType: "quote_request", ownerId: requestA, file: new Uint8Array(0) }))).toEqual({ status: 400, body: { code: "EMPTY" } });
  });

  it(`limits each user to ${UPLOAD_LIMITS.perUserPerHour} uploads an hour`, async () => {
    for (let i = 0; i < UPLOAD_LIMITS.perUserPerHour; i++) expect((await send(upload({ ownerType: "quote_request", ownerId: requestA, file: pdf(100) }))).status).toBe(201);
    expect(await send(upload({ ownerType: "quote_request", ownerId: requestA, file: pdf(100) }))).toEqual({ status: 429, body: { code: "RATE_LIMITED" } });
    state.user = customerB; // per user, not global
    expect((await send(upload({ ownerType: "quote_request", ownerId: requestB, file: pdf(100) }))).status).toBe(201);
  });
});
