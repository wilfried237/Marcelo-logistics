/**
 * Document upload size limits (Stage 6, owner decision D1: 4 MB per file).
 *
 * Uploads go to a dedicated route handler (POST /api/documents), not a Server
 * Action, so the project-wide Server Action body limit stays at Next.js's 1 MB
 * default for every other form. Three limits stack:
 *
 * 1. The file itself: at most MAX_DOCUMENT_BYTES (4 MiB). Enforced by the upload
 *    form (before sending), the route and the document service.
 * 2. The whole upload request (multipart boundaries and the two other fields
 *    come on top of the file): at most UPLOAD_REQUEST_MAX_BYTES. The route
 *    refuses a larger declared Content-Length before reading anything, and stops
 *    reading a body (for example a chunked one) as soon as it passes the limit.
 * 3. Vercel Functions accept request bodies up to 4.5 MB. The upload request
 *    limit stays below that, even reading "4.5 MB" as 4,500,000 bytes.
 *
 * tests/unit/upload-limits.test.ts keeps these relations true. The private
 * storage bucket has its own, higher limit (10 MB); it is never reached.
 */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024; // 4,194,304 bytes

/** Room for multipart framing and the other fields (measured: about 1 KB). */
export const UPLOAD_REQUEST_OVERHEAD_BYTES = 64 * 1024;

/** 4,259,840 bytes: the most the upload route will read. */
export const UPLOAD_REQUEST_MAX_BYTES = MAX_DOCUMENT_BYTES + UPLOAD_REQUEST_OVERHEAD_BYTES;

/** Vercel Functions request body limit, read conservatively as decimal megabytes. */
export const VERCEL_REQUEST_BODY_LIMIT_BYTES = 4_500_000;

/** For user-facing text: "4 MB" / "4 Mo". */
export const MAX_DOCUMENT_MEGABYTES = MAX_DOCUMENT_BYTES / (1024 * 1024);

/** Per signed-in user (customers and staff alike). */
export const UPLOAD_LIMITS = { perUserPerHour: 30 } as const;
