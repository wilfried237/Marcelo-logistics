import type { RetentionPolicy } from "@/config/retention";
import { withSystem } from "@/lib/db/context";
import type { Database } from "@/lib/db/types";
import type { DocumentStorage } from "./documents";

const DAY = 86_400_000;

export interface RetentionReport {
  mode: "dry-run" | "execute";
  /** Documents whose retention period has ended. */
  documentsEligible: number;
  documentsDeleted: number;
  documentsFailed: number;
  /** Closed quote requests past the reporting period. Reported only: never deleted automatically. */
  closedQuoteRequestsEligible: number;
}

export type RetentionRefusal = { refused: true; reason: "policy_not_approved" | "execution_disabled" };

/**
 * Identifies and (only when explicitly approved and enabled) deletes records
 * whose retention has ended. Missing dates never make a record eligible:
 * - documents qualify only through an explicit `retention_until` in the past or
 *   an approved `documentsAfterDays` period;
 * - quote requests are only counted, because removing them would break audit
 *   and financial history (anonymisation is a separate, future decision).
 * Deleting a document removes the private file first; the metadata row is
 * removed only if that succeeded, and the audit trigger records the deletion.
 * Re-running after a completed run finds nothing (idempotent).
 */
export async function runRetention(
  db: Database,
  storage: DocumentStorage,
  options: { policy: RetentionPolicy; execute: boolean; executionEnabled: boolean; now?: Date },
): Promise<RetentionReport | RetentionRefusal> {
  const now = options.now ?? new Date();
  if (options.execute && !options.policy.approved) return { refused: true, reason: "policy_not_approved" };
  if (options.execute && !options.executionEnabled) return { refused: true, reason: "execution_disabled" };

  const documentCutoff = options.policy.approved && options.policy.documentsAfterDays !== null ? new Date(now.getTime() - options.policy.documentsAfterDays * DAY) : null;
  const documents = await withSystem(db, null, (tx) =>
    tx.document.findMany({
      where: {
        OR: [{ retentionUntil: { lt: now } }, ...(documentCutoff ? [{ retentionUntil: null, createdAt: { lt: documentCutoff } }] : [])],
      },
      select: { id: true, storageKey: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
  );

  const requestCutoff =
    options.policy.closedQuoteRequestsAfterDays !== null ? new Date(now.getTime() - options.policy.closedQuoteRequestsAfterDays * DAY) : null;
  const closedQuoteRequestsEligible = requestCutoff
    ? await withSystem(db, null, (tx) => tx.quoteRequest.count({ where: { status: { in: ["DECLINED", "EXPIRED", "CANCELLED"] }, updatedAt: { lt: requestCutoff } } }))
    : 0;

  const report: RetentionReport = {
    mode: options.execute ? "execute" : "dry-run",
    documentsEligible: documents.length,
    documentsDeleted: 0,
    documentsFailed: 0,
    closedQuoteRequestsEligible,
  };
  if (!options.execute) return report;

  for (const doc of documents) {
    try {
      await storage.remove(doc.storageKey);
    } catch {
      report.documentsFailed++;
      continue; // keep the metadata so the file is never orphaned or forgotten
    }
    await withSystem(db, null, (tx) => tx.document.deleteMany({ where: { id: doc.id } }));
    report.documentsDeleted++;
  }
  return report;
}
