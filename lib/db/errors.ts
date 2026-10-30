/**
 * Maps database errors (as surfaced by Prisma and its PostgreSQL driver
 * adapter) to stable application error codes. Raw SQL messages, constraint
 * names and stack traces are never returned to clients.
 */
export const DOMAIN_ERROR_CODES = [
  "invalid_quote_transition",
  "sent_quote_required",
  "quote_not_valid",
  "quote_request_not_under_review",
  "quote_already_sent",
  "quote_not_accepted",
  "immutable_field",
  "created_by_mismatch",
  "role_change_forbidden",
  "forbidden",
  "last_admin",
  "not_found",
  "document_owner_not_found",
] as const;
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number] | "conflict" | "invalid_data" | "permission_denied" | "unknown";

type ErrorLike = { code?: unknown; message?: unknown; meta?: unknown; cause?: unknown; kind?: unknown; originalCode?: unknown };

/** Flattens an error, its `meta` and its `cause` chain into one searchable string plus codes. */
function describe(error: unknown): { text: string; codes: string[] } {
  const parts: string[] = [];
  const codes: string[] = [];
  let current = error as ErrorLike | undefined;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current.message === "string") parts.push(current.message);
    if (typeof current.code === "string") codes.push(current.code);
    if (typeof current.kind === "string") codes.push(current.kind);
    if (typeof current.originalCode === "string") codes.push(current.originalCode);
    if (current.meta) {
      try {
        const meta = JSON.stringify(current.meta);
        parts.push(meta);
        const original = /"originalCode":"([0-9A-Z]{5})"/.exec(meta);
        if (original) codes.push(original[1]);
        const kind = /"kind":"([A-Za-z]+)"/.exec(meta);
        if (kind) codes.push(kind[1]);
      } catch {
        // ignore unserialisable meta
      }
    }
    current = current.cause as ErrorLike | undefined;
  }
  return { text: parts.join(" "), codes };
}

export function domainErrorCode(error: unknown): DomainErrorCode {
  const { text, codes } = describe(error);
  for (const code of DOMAIN_ERROR_CODES) if (new RegExp(`\\b${code}\\b`).test(text)) return code;
  if (codes.some((c) => c === "23505" || c === "P2002" || c === "UniqueConstraintViolation")) return "conflict";
  if (codes.some((c) => ["23514", "22P02", "22001", "23502", "P2000", "P2011", "P2012", "NullConstraintViolation"].includes(c))) return "invalid_data";
  if (codes.includes("42501") || /row-level security|permission denied/i.test(text)) return "permission_denied";
  return "unknown";
}

/** True for a unique violation; `target` matches the constraint name or column list when given. */
export function isUniqueViolation(error: unknown, target?: string): boolean {
  const { text, codes } = describe(error);
  const unique = codes.some((c) => c === "23505" || c === "P2002" || c === "UniqueConstraintViolation");
  return unique && (!target || text.includes(target));
}
