/**
 * Document upload size limits (Stage 6, owner decision D1: 4 MB per file).
 *
 * Uploads travel through a Next.js Server Action, so three limits stack:
 *
 * 1. The file itself: at most MAX_DOCUMENT_BYTES (4 MiB). Enforced by the
 *    upload form (before sending), the server action and the document service.
 * 2. The whole Server Action request body (multipart boundaries, the other
 *    form fields and the action headers come on top of the file): Next.js
 *    refuses anything above SERVER_ACTION_BODY_LIMIT_BYTES with 413. Its
 *    default is 1 MB, which is why next.config.ts must raise it.
 * 3. Vercel Functions accept request bodies up to 4.5 MB. The Server Action
 *    limit stays below that, even reading "4.5 MB" as 4,500,000 bytes.
 *
 * tests/unit/upload-limits.test.ts keeps these relations true. The private
 * storage bucket has its own, higher limit (10 MB); it is never reached.
 */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024; // 4,194,304 bytes

/** Room for multipart framing and the other fields (measured overhead is well under 1 KB). */
export const SERVER_ACTION_OVERHEAD_BYTES = 256 * 1024;

/** 4,456,448 bytes ("4.25mb" in Next.js notation). */
export const SERVER_ACTION_BODY_LIMIT_BYTES = MAX_DOCUMENT_BYTES + SERVER_ACTION_OVERHEAD_BYTES;

/** Vercel Functions request body limit, read conservatively as decimal megabytes. */
export const VERCEL_REQUEST_BODY_LIMIT_BYTES = 4_500_000;

/** For user-facing text: "4 MB" / "4 Mo". */
export const MAX_DOCUMENT_MEGABYTES = MAX_DOCUMENT_BYTES / (1024 * 1024);
