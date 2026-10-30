/**
 * DATA RETENTION POLICY (owner decision L-03).
 *
 * No retention periods are invented here. While `approved` is false, retention
 * jobs only ever run in dry-run mode: they report what WOULD be eligible and
 * delete nothing. Periods are in days; null means "no automatic deletion".
 *
 * Once the owner (and, where needed, a solicitor) approves periods:
 * 1. fill in the periods and set approved: true;
 * 2. set RETENTION_EXECUTION_ENABLED=true in the target environment.
 */
export interface RetentionPolicy {
  approved: boolean;
  /** Private documents: delete this many days after upload (per-document `retention_until` always wins). */
  documentsAfterDays: number | null;
  /** Quote requests that never became shipments (DECLINED / EXPIRED / CANCELLED): report after this many days. */
  closedQuoteRequestsAfterDays: number | null;
}

export const retentionPolicy: RetentionPolicy = {
  approved: false, // {{NEEDS_OWNER}} L-03
  documentsAfterDays: null,
  closedQuoteRequestsAfterDays: null,
};
