import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import { insertRequest } from "../db/fixtures";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { MAX_DOCUMENT_BYTES } from "@/lib/config/upload-limits";
import { renderOutboxEmail } from "@/lib/email/render";
import { AuthorizationError } from "@/lib/auth/types";
import { documentDownloadUrl, listDocuments, listRecordDocuments, listRecordDocumentsForStaff, safeFileName, sniffMime, uploadDocument, type DocumentStorage } from "@/lib/services/documents";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

class MemoryStorage implements DocumentStorage {
  files = new Map<string, Uint8Array>();
  failInsert = false;
  async upload(key: string, bytes: Uint8Array) {
    this.files.set(key, bytes);
  }
  async remove(key: string) {
    this.files.delete(key);
  }
  async signedUrl(key: string) {
    return `https://storage.example.test/signed/${key}?token=short-lived`;
  }
}

let t: TestDb;
let db: Database;
let a: AppUser;
let b: AppUser;
let staff: AppUser;
let requestA: string;
let requestB: string;
const storage = new MemoryStorage();

beforeAll(async () => {
  t = await createTestDb();
  db = t.db as unknown as Database;
  const ua = await createUser(t.client, "doc.a@example.test");
  const ub = await createUser(t.client, "doc.b@example.test");
  const us = await createUser(t.client, "doc.staff@example.test", "staff");
  a = (await loadAppUser(db, ua.id, null))!;
  b = (await loadAppUser(db, ub.id, null))!;
  staff = (await loadAppUser(db, us.id, null))!;
  requestA = await insertRequest(t.client, ua.customerId, "QRDOCAAA");
  requestB = await insertRequest(t.client, ub.customerId, "QRDOCBBB");
});
afterAll(async () => t?.close());

describe("document type detection", () => {
  it("uses file content, not the declared type", () => {
    expect(sniffMime(PDF)).toBe("application/pdf");
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(EXE)).toBeNull();
    expect(sniffMime(new TextEncoder().encode("<html><script>"))).toBeNull();
  });

  it("sanitises display names", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Users\\x\\invoice<1>.pdf")).toBe("invoice1.pdf");
    expect(safeFileName("")).toBe("document");
  });
});

describe("private documents", () => {
  let docA = "";

  it("lets a customer attach a valid file to their own request", async () => {
    const result = await uploadDocument(db, storage, a, { ownerType: "quote_request", ownerId: requestA, fileName: "invoice.pdf", bytes: PDF });
    expect(result.ok).toBe(true);
    if (result.ok) docA = result.id;
    expect([...storage.files.keys()][0]).toMatch(/^[0-9a-f-]{36}\/quote_request\/[0-9a-f-]{36}\.pdf$/);
  });

  it("rejects disallowed types, empty and oversize files", async () => {
    expect(await uploadDocument(db, storage, a, { ownerType: "quote_request", ownerId: requestA, fileName: "x.pdf", bytes: EXE })).toEqual({ ok: false, code: "type" });
    expect(await uploadDocument(db, storage, a, { ownerType: "quote_request", ownerId: requestA, fileName: "x.pdf", bytes: new Uint8Array() })).toEqual({ ok: false, code: "too_large" });
    const big = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
    big.set(PDF);
    expect(await uploadDocument(db, storage, a, { ownerType: "quote_request", ownerId: requestA, fileName: "x.pdf", bytes: big })).toEqual({ ok: false, code: "too_large" });
  });

  it("denies attaching files to another customer's request without storing anything", async () => {
    const before = storage.files.size;
    expect(await uploadDocument(db, storage, a, { ownerType: "quote_request", ownerId: requestB, fileName: "x.pdf", bytes: PDF })).toEqual({ ok: false, code: "not_found" });
    expect(storage.files.size).toBe(before);
  });

  it("only lists and signs documents the user may see", async () => {
    expect((await listDocuments(db, a)).map((d) => d.id)).toEqual([docA]);
    expect(await listDocuments(db, b)).toEqual([]);
    expect(await documentDownloadUrl(db, storage, b, docA)).toBeNull();
    expect(await documentDownloadUrl(db, storage, a, "not-a-uuid")).toBeNull();
    expect(await documentDownloadUrl(db, storage, a, docA)).toMatch(/^https:\/\/storage\.example\.test\/signed\//);
    expect(await documentDownloadUrl(db, storage, staff, docA)).not.toBeNull();
  });
});

describe("4 MB limit (D1, Stage 6)", () => {
  const sized = (header: Uint8Array, size: number) => {
    const bytes = new Uint8Array(size);
    bytes.set(header);
    return bytes;
  };
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

  it("accepts PDF, JPEG and PNG files of exactly 4 MB", async () => {
    for (const [name, header] of [["at-limit.pdf", PDF], ["at-limit.jpg", JPEG], ["at-limit.png", PNG]] as const) {
      const result = await uploadDocument(db, storage, b, { ownerType: "quote_request", ownerId: requestB, fileName: name, bytes: sized(header, MAX_DOCUMENT_BYTES) });
      expect(result.ok, name).toBe(true);
    }
  });

  it("rejects one byte over 4 MB without storing anything", async () => {
    const before = storage.files.size;
    expect(await uploadDocument(db, storage, b, { ownerType: "quote_request", ownerId: requestB, fileName: "over.pdf", bytes: sized(PDF, MAX_DOCUMENT_BYTES + 1) })).toEqual({ ok: false, code: "too_large" });
    expect(storage.files.size).toBe(before);
  });
});

describe("documents on a quote request or shipment page (Stage 6)", () => {
  it("customers see only their own record's documents, marked as theirs; other ids give nothing", async () => {
    const own = await listRecordDocuments(db, a, "quote_request", requestA);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((d) => d.addedByYou === true)).toBe(true);
    expect(own[0]).not.toHaveProperty("storageKey");
    expect(await listRecordDocuments(db, b, "quote_request", requestA)).toEqual([]);
    expect(await listRecordDocuments(db, a, "quote_request", "not-a-uuid")).toEqual([]);
    expect(await listRecordDocuments(db, a, "shipment", requestA)).toEqual([]);
  });

  it("staff see every document with who uploaded it; a staff upload shows as 'added by us' to the customer", async () => {
    const before = await listRecordDocumentsForStaff(db, staff, "quote_request", requestA);
    expect(before.every((d) => d.uploader?.kind === "customer" && d.uploader.name === null)).toBe(true);
    const staffUpload = await uploadDocument(db, storage, staff, { ownerType: "quote_request", ownerId: requestA, fileName: "quotation-annex.pdf", bytes: PDF });
    expect(staffUpload.ok).toBe(true);
    const after = await listRecordDocumentsForStaff(db, staff, "quote_request", requestA);
    expect(after.find((d) => d.originalName === "quotation-annex.pdf")?.uploader).toEqual({ kind: "staff", name: "Test User" });
    const customerView = await listRecordDocuments(db, a, "quote_request", requestA);
    expect(customerView.find((d) => d.originalName === "quotation-annex.pdf")?.addedByYou).toBe(false);
  });

  it("the staff view is staff-only", async () => {
    await expect(listRecordDocumentsForStaff(db, a, "quote_request", requestA)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("staff alert on customer uploads (Stage 6)", () => {
  const alerts = async (documentId?: string) =>
    (
      await t.client.query<{ entity_id: string; audience: string; recipient: string | null; locale: string; payload: unknown }>(
        `select entity_id, audience, recipient, locale::text, payload from public.email_deliveries where template = 'staff_document_uploaded'${documentId ? " and entity_id = $1" : ""}`,
        documentId ? [documentId] : [],
      )
    ).rows;

  it("a customer upload queues exactly one staff-only alert, without the file name", async () => {
    const result = await uploadDocument(db, storage, a, { ownerType: "quote_request", ownerId: requestA, fileName: "passport-scan-Ngozi.pdf", bytes: PDF });
    if (!result.ok) throw new Error(result.code);
    expect(await alerts(result.id)).toEqual([{ entity_id: result.id, audience: "staff", recipient: null, locale: "en", payload: {} }]);
    // Queueing it again is ignored (one outbox key per document).
    await t.client.query("select public.app_enqueue_email('staff_document_uploaded', 'staff', 'documents', $1, $2, null, 'en', '{}')", [result.id, `staff_document_uploaded:${result.id}`]);
    expect(await alerts(result.id)).toHaveLength(1);
    const [row] = (await t.client.query<{ id: string; template: string; audience: "staff"; recipient: null; locale: "en"; entity: string; entity_id: string; payload: Record<string, unknown> }>(
      "select id, template, audience, recipient, locale::text as locale, entity, entity_id, payload from public.email_deliveries where template = 'staff_document_uploaded' and entity_id = $1",
      [result.id],
    )).rows;
    const rendered = await renderOutboxEmail(db, { id: row.id, template: row.template, audience: "staff", recipient: null, locale: "en", entity: row.entity, entityId: row.entity_id, payload: row.payload });
    if ("skip" in rendered) throw new Error(rendered.skip);
    expect(rendered.subject).toBe("New document on QRDOCAAA");
    expect(JSON.stringify(rendered.props)).toContain("PDF file (1 KB)");
    expect(JSON.stringify(rendered.props)).not.toContain("passport-scan");
  });

  it("staff uploads and refused uploads queue no alert", async () => {
    const before = (await alerts()).length;
    expect((await uploadDocument(db, storage, staff, { ownerType: "quote_request", ownerId: requestA, fileName: "staff.pdf", bytes: PDF })).ok).toBe(true);
    expect((await uploadDocument(db, storage, a, { ownerType: "quote_request", ownerId: requestA, fileName: "x.exe", bytes: EXE })).ok).toBe(false);
    expect((await uploadDocument(db, storage, a, { ownerType: "quote_request", ownerId: requestB, fileName: "x.pdf", bytes: PDF })).ok).toBe(false);
    expect((await alerts()).length).toBe(before);
  });
});
