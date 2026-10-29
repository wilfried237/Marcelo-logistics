/**
 * Maps database errors to stable application error codes. Raw SQL messages,
 * constraint names and stack traces are never returned to clients.
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

type PgLikeError = { code?: string; message?: string; constraint?: string; cause?: unknown };

function unwrap(error: unknown): PgLikeError {
  let current = error as PgLikeError;
  // Drizzle wraps driver errors in `cause`.
  for (let i = 0; i < 3 && current?.cause && !current.code; i++) current = current.cause as PgLikeError;
  return current ?? {};
}

export function domainErrorCode(error: unknown): DomainErrorCode {
  const e = unwrap(error);
  const message = e.message ?? "";
  for (const code of DOMAIN_ERROR_CODES) if (message.includes(code)) return code;
  if (e.code === "23505") return "conflict";
  if (e.code === "23514" || e.code === "22P02" || e.code === "22001" || e.code === "23502") return "invalid_data";
  if (e.code === "42501" || /row-level security|permission denied/.test(message)) return "permission_denied";
  return "unknown";
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = unwrap(error);
  if (e.code !== "23505") return false;
  return !constraint || (e.constraint ?? e.message ?? "").includes(constraint);
}
