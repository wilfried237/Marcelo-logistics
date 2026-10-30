import { randomUUID } from "node:crypto";
import { withSystem, withUser } from "@/lib/db/context";
import { domainErrorCode } from "@/lib/db/errors";
import type { Database } from "@/lib/db/types";
import type { AppUser } from "@/lib/auth/types";
import { MAX_DOCUMENT_BYTES, type DocumentMimeType, type DocumentOwnerType } from "@/lib/domain/enums";

/** Storage adapter (Supabase Storage in production, in-memory in tests). */
export interface DocumentStorage {
  upload(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

/**
 * Identifies the real file type from its first bytes. The browser-declared MIME
 * type and file extension are ignored.
 */
export function sniffMime(bytes: Uint8Array): DocumentMimeType | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}

const EXTENSION: Record<DocumentMimeType, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UploadResult = { ok: true; id: string } | { ok: false; code: "too_large" | "type" | "not_found" | "generic" };

/** Safe display name: no path components or control characters, bounded length. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim().slice(0, 120);
  return cleaned || "document";
}

export async function uploadDocument(
  db: Database,
  storage: DocumentStorage,
  user: AppUser,
  input: { ownerType: DocumentOwnerType; ownerId: string; fileName: string; bytes: Uint8Array },
): Promise<UploadResult> {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_DOCUMENT_BYTES) return { ok: false, code: "too_large" };
  const mime = sniffMime(input.bytes);
  if (!mime) return { ok: false, code: "type" };
  if (!UUID.test(input.ownerId)) return { ok: false, code: "not_found" };

  // Ownership check through RLS: the owner record must be visible to this user.
  const owner = await withUser(db, user.id, (tx) =>
    input.ownerType === "quote_request"
      ? tx.quoteRequest.findUnique({ where: { id: input.ownerId }, select: { customerId: true } })
      : tx.shipment.findUnique({ where: { id: input.ownerId }, select: { customerId: true } }),
  );
  if (!owner) return { ok: false, code: "not_found" };

  // Server-generated key: no user input reaches the storage path.
  const key = `${owner.customerId}/${input.ownerType}/${randomUUID()}.${EXTENSION[mime]}`;
  try {
    await storage.upload(key, input.bytes, mime);
  } catch {
    return { ok: false, code: "generic" };
  }
  try {
    const row = await withUser(db, user.id, (tx) =>
      tx.document.create({
        data: {
          ownerType: input.ownerType,
          ownerId: input.ownerId,
          // customer_id is overwritten by the trigger from the owner record.
          customerId: owner.customerId,
          storageKey: key,
          originalName: safeFileName(input.fileName),
          mime,
          sizeBytes: input.bytes.byteLength,
          uploadedBy: user.id,
        },
        select: { id: true },
      }),
    );
    return { ok: true, id: row.id };
  } catch (error) {
    // Never leave an orphaned private file behind.
    await storage.remove(key).catch(() => undefined);
    console.error("document metadata insert failed", domainErrorCode(error));
    return { ok: false, code: "generic" };
  }
}

export async function listDocuments(db: Database, user: AppUser) {
  return withUser(db, user.id, (tx) =>
    tx.document.findMany({
      select: { id: true, ownerType: true, ownerId: true, originalName: true, mime: true, sizeBytes: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
}

/**
 * Returns a short-lived signed URL only if RLS lets this user see the document.
 * The storage key is read with the privileged connection after that check,
 * because API roles are not granted the storage_key column.
 */
export async function documentDownloadUrl(db: Database, storage: DocumentStorage, user: AppUser, documentId: string): Promise<string | null> {
  if (!UUID.test(documentId)) return null;
  const visible = await withUser(db, user.id, (tx) => tx.document.findUnique({ where: { id: documentId }, select: { id: true } }));
  if (!visible) return null;
  const row = await withSystem(db, user.id, (tx) => tx.document.findUnique({ where: { id: documentId }, select: { storageKey: true } }));
  if (!row) return null;
  return storage.signedUrl(row.storageKey, 60);
}
