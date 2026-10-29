import type { QuoteStatus, UserRole } from "./enums";

/**
 * Permitted quote-request transitions. The database enforces the same table in
 * the trigger app_enforce_quote_request_rules (drizzle/0001_*.sql); a unit test
 * keeps both in sync.
 *
 * SUBMITTED -> UNDER_REVIEW -> (AWAITING_CUSTOMER <-> UNDER_REVIEW) -> QUOTED
 *           -> ACCEPTED | DECLINED | EXPIRED
 * Documented additions to the linear chain:
 * - UNDER_REVIEW -> QUOTED: staff can quote without asking for more information.
 * - AWAITING_CUSTOMER -> UNDER_REVIEW: review resumes once the customer replies.
 * - AWAITING_CUSTOMER -> QUOTED: the missing information arrived by phone/email.
 * - Any status except CANCELLED -> CANCELLED, with a mandatory reason.
 */
export const QUOTE_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["AWAITING_CUSTOMER", "QUOTED", "CANCELLED"],
  AWAITING_CUSTOMER: ["UNDER_REVIEW", "QUOTED", "CANCELLED"],
  QUOTED: ["ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"],
  ACCEPTED: ["CANCELLED"],
  DECLINED: ["CANCELLED"],
  EXPIRED: ["CANCELLED"],
  CANCELLED: [],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from].includes(to);
}

/** Who may request each target status. "system" = scheduled expiry. */
export type TransitionActor = UserRole | "system";

export function actorMayTransition(actor: TransitionActor, from: QuoteStatus, to: QuoteStatus): boolean {
  if (!canTransition(from, to)) return false;
  switch (to) {
    case "ACCEPTED":
    case "DECLINED":
      return actor === "customer";
    case "EXPIRED":
      return actor === "system";
    default:
      return actor === "staff" || actor === "admin";
  }
}

export function isTerminal(status: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[status].every((s) => s === "CANCELLED");
}

export const CANCELLATION_REASON_MAX = 500;
