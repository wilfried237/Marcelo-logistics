import { timingSafeEqual } from "node:crypto";
import { withSystem, withUser } from "@/lib/db/context";
import { assertStaff, type AppUser } from "@/lib/auth/types";
import { SCHEDULED_JOBS, evaluateJobHealth, type JobRunRecord } from "@/lib/domain/job-health";
import type { Database } from "@/lib/db/types";

/**
 * Expires QUOTED requests whose sent quotes are all past `valid_until`.
 *
 * Safety comes from app_expire_quotes() in the database:
 * - the UPDATE re-checks `status = 'QUOTED'` and validity under row locks, so a
 *   concurrent acceptance or cancellation is never overwritten and two
 *   concurrent runs never expire the same request twice;
 * - the lifecycle trigger validates QUOTED -> EXPIRED and the audit trigger
 *   records each change in the same transaction (actor = NULL, "system").
 * Idempotent: a second run finds nothing to do.
 */
export async function expireQuotes(db: Database): Promise<{ expired: number }> {
  const rows = await withSystem(db, null, (tx) => tx.$queryRaw<{ expired: number }[]>`select public.app_expire_quotes() as expired`);
  return { expired: Number(rows[0]?.expired ?? 0) };
}

/**
 * Validates `Authorization: Bearer <CRON_SECRET>` in constant time. Returns
 * "disabled" when no secret is configured, so jobs never run unauthenticated.
 */
export function checkCronAuth(authorization: string | null, secret: string | undefined): "ok" | "unauthorised" | "disabled" {
  if (!secret || secret.length < 32) return "disabled";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization ?? "");
  if (given.length !== expected.length) return "unauthorised";
  return timingSafeEqual(given, expected) ? "ok" : "unauthorised";
}

/**
 * Runs a scheduled job and records it in job_runs (start, end, outcome, summary).
 * A failure is logged without customer data and queues ONE staff alert per job
 * per day (outbox key), then rethrows so the route reports the failure.
 */
export async function runJob<T extends Record<string, unknown>>(db: Database, job: string, fn: () => Promise<T>): Promise<T> {
  const run = await db.jobRun.create({ data: { job }, select: { id: true } });
  try {
    const summary = await fn();
    await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: true, summary: JSON.parse(JSON.stringify(summary)) } });
    return summary;
  } catch (error) {
    const message = (error instanceof Error ? `${error.name}: ${error.message}` : "unknown error").slice(0, 1000);
    await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: false, error: message } }).catch(() => undefined);
    const day = new Date().toISOString().slice(0, 10);
    await db.$executeRaw`select public.app_enqueue_email('staff_job_failure', 'staff', 'job_runs', ${String(run.id)}, ${`staff_job_failure:${job}:${day}`}, null, 'en'::public.app_locale,
      ${JSON.stringify({ job, error: message.slice(0, 300) })}::jsonb)`.catch(() => undefined);
    throw error;
  }
}

/**
 * Queues "quotation expires soon" reminders when configured
 * (ownerConfig.notifications.quoteExpiryReminderHours; null = disabled).
 * One reminder per quote (outbox key), so repeated runs never send twice.
 */
export async function queueExpiryReminders(db: Database, hours: number | null): Promise<{ reminders: number }> {
  if (!hours || hours <= 0) return { reminders: 0 };
  const rows = await db.$queryRaw<{ n: number }[]>`
    with due as (
      select distinct on (r.id) r.id as request_id, q.id as quote_id, c.email, r.locale
        from public.quote_requests r
        join public.quotes q on q.quote_request_id = r.id and q.sent_at is not null
        join public.customers c on c.id = r.customer_id
       where r.status = 'QUOTED' and q.valid_until > now() and q.valid_until <= now() + make_interval(hours => ${hours})
       order by r.id, q.sent_at desc)
    select count(*)::int as n from due,
      lateral (select public.app_enqueue_email('quote_expiring', 'customer', 'quote_requests', due.request_id::text,
        'quote_expiring:' || due.quote_id, due.email, due.locale, jsonb_build_object('quoteId', due.quote_id))) x`;
  return { reminders: Number(rows[0]?.n ?? 0) };
}

/**
 * Health of the scheduled jobs for the staff notifications page (Stage 6).
 * Read-only, through RLS (job_runs is staff-only): the latest run, latest
 * success, latest finished run and unfinished runs of each scheduled job, then
 * the rules in lib/domain/job-health.ts. Also the 30 most recent runs.
 */
export async function getJobHealth(db: Database, user: AppUser, now: Date = new Date()) {
  assertStaff(user);
  const select = { id: true, job: true, startedAt: true, finishedAt: true, ok: true } as const;
  return withUser(db, user.id, async (tx) => {
    const perJob = await Promise.all(
      SCHEDULED_JOBS.map((job) =>
        Promise.all([
          tx.jobRun.findFirst({ where: { job }, orderBy: { startedAt: "desc" }, select }),
          tx.jobRun.findFirst({ where: { job, ok: true }, orderBy: { startedAt: "desc" }, select }),
          tx.jobRun.findFirst({ where: { job, finishedAt: { not: null } }, orderBy: { startedAt: "desc" }, select }),
          tx.jobRun.findMany({ where: { job, finishedAt: null }, orderBy: { startedAt: "desc" }, select, take: 50 }),
        ]),
      ),
    );
    const byId = new Map<string, JobRunRecord>();
    for (const [latest, success, finished, unfinished] of perJob) {
      for (const run of [latest, success, finished, ...unfinished]) if (run) byId.set(String(run.id), run);
    }
    const recent = await tx.jobRun.findMany({ select: { ...select, error: true }, orderBy: { startedAt: "desc" }, take: 30 });
    return { ...evaluateJobHealth([...byId.values()], now), recent: recent.map((r) => ({ ...r, id: String(r.id) })) };
  });
}
