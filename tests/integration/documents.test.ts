import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createUser, type TestDb } from "../db/harness";
import { insertRequest } from "../db/fixtures";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { loadAppUser } from "@/lib/services/users";
import { documentDownloadUrl, listDocuments, safeFileName, sniffMime, uploadDocument, type DocumentStorage } from "@/lib/services/documents";

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
afterAll(async () => t?.client.close());

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
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
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
