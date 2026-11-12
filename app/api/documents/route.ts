import { NextResponse, type NextRequest } from "next/server";
import { documentUploadsAvailable } from "@/lib/config/env";
import { MAX_DOCUMENT_BYTES, UPLOAD_LIMITS, UPLOAD_REQUEST_MAX_BYTES } from "@/lib/config/upload-limits";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { deliverQueuedEmailsSoon } from "@/lib/email/dispatch";
import { readLimitedBody } from "@/lib/http/read-limited-body";
import { uploadDocument } from "@/lib/services/documents";
import { hashKey, rateLimitHit } from "@/lib/services/rate-limit";
import { supabaseDocumentStorage } from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };
const reply = (status: number, code: string, extra: Record<string, unknown> = {}) => NextResponse.json({ code, ...extra }, { status, headers: NO_STORE });

/** Same-origin check for a cookie-authenticated POST (route handlers have no built-in CSRF check, unlike Server Actions). */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Document upload (Stage 6). A dedicated route handler, so the project-wide
 * Server Action body limit stays at 1 MB. Order of checks, cheapest first and
 * nothing read before the caller is known:
 *
 * 1. same origin, 2. signed in, 3. uploads switched on (ENABLE_DOCUMENT_UPLOADS),
 * 4. multipart content type, 5. declared Content-Length within the limit,
 * 6. per-user rate limit (fails closed), 7. body read with a hard cap,
 * 8. well-formed fields, 9. file 1 byte to 4 MiB.
 *
 * Then the existing document service decides: the file's real type (PDF, JPEG,
 * PNG), and whether the record exists for THIS user under RLS (customers: own
 * requests and shipments only; staff: any). It stores the file privately under
 * a server-generated key and records the uploader (audited).
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply(403, "FORBIDDEN_ORIGIN");
  const user = await getCurrentUser();
  if (!user) return reply(401, "UNAUTHENTICATED");
  if (!documentUploadsAvailable()) return reply(403, "UPLOADS_DISABLED");

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) return reply(415, "UNSUPPORTED_MEDIA_TYPE");
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > UPLOAD_REQUEST_MAX_BYTES)) return reply(413, "TOO_LARGE");

  const db = getDb();
  try {
    if (!(await rateLimitHit(db, hashKey("upload:user", user.id), 3600, UPLOAD_LIMITS.perUserPerHour))) return reply(429, "RATE_LIMITED");
  } catch {
    return reply(503, "UNAVAILABLE"); // the limiter fails closed
  }

  const body = await readLimitedBody(request.body, UPLOAD_REQUEST_MAX_BYTES);
  if (body === "too_large") return reply(413, "TOO_LARGE");
  let form: FormData;
  try {
    form = await new Response(body as BodyInit, { headers: { "content-type": contentType } }).formData();
  } catch {
    return reply(400, "MALFORMED");
  }
  const ownerType = form.get("ownerType");
  const ownerId = form.get("ownerId");
  const file = form.get("file");
  if ((ownerType !== "quote_request" && ownerType !== "shipment") || typeof ownerId !== "string" || !UUID.test(ownerId) || !(file instanceof File)) {
    return reply(400, "MALFORMED");
  }
  if (file.size === 0) return reply(400, "EMPTY");
  if (file.size > MAX_DOCUMENT_BYTES) return reply(413, "TOO_LARGE");

  const result = await uploadDocument(db, supabaseDocumentStorage(), user, { ownerType, ownerId, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (!result.ok) {
    const map = { too_large: [413, "TOO_LARGE"], type: [415, "TYPE"], not_found: [404, "NOT_FOUND"], generic: [500, "FAILED"] } as const;
    const [status, code] = map[result.code];
    return reply(status, code);
  }
  deliverQueuedEmailsSoon(); // the staff alert for a customer upload
  return reply(201, "UPLOADED", { id: result.id });
}
