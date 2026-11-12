/**
 * Scheduled-job health (Stage 6). Calculated from the existing job_runs records
 * when a staff page loads: no new job, no write, no external monitor.
 *
 * Rules (approved scope):
 * - a run still unfinished 15 minutes after it started is flagged (the function
 *   was killed or timed out, so runJob never recorded an end);
 * - a job without a successful run in the last 36 hours gets a warning (the
 *   daily cron has missed at least one run, or keeps failing);
 * - the most recent finished run failing is reported as a failure.
 */

/** The jobs Vercel runs on a schedule (vercel.json "crons"; a test keeps the two in step). */
export const SCHEDULED_JOBS = ["expire-quotes", "process-emails"] as const;
export type ScheduledJob = (typeof SCHEDULED_JOBS)[number];

export const STUCK_AFTER_MINUTES = 15;
export const NO_SUCCESS_WARNING_HOURS = 36;

export interface JobRunRecord {
  job: string;
  startedAt: Date;
  finishedAt: Date | null;
  ok: boolean | null;
}

export type JobState = "ok" | "warning" | "failed";

export interface JobHealth {
  job: string;
  state: JobState;
  lastSuccess: Date | null;
  lastRun: JobRunRecord | null;
  /** Unfinished runs older than STUCK_AFTER_MINUTES. */
  stuckRuns: number;
  noRecentSuccess: boolean;
  lastRunFailed: boolean;
}

/** `runs` must include, per job, its latest run, its latest success and its unfinished runs (any order). */
export function evaluateJobHealth(runs: readonly JobRunRecord[], now: Date, jobs: readonly string[] = SCHEDULED_JOBS): { jobs: JobHealth[]; state: JobState } {
  const stuckBefore = now.getTime() - STUCK_AFTER_MINUTES * 60_000;
  const successAfter = now.getTime() - NO_SUCCESS_WARNING_HOURS * 3_600_000;
  const health = jobs.map((job): JobHealth => {
    const mine = runs.filter((r) => r.job === job).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const lastSuccess = mine.find((r) => r.ok === true)?.finishedAt ?? mine.find((r) => r.ok === true)?.startedAt ?? null;
    const stuckRuns = mine.filter((r) => r.finishedAt === null && r.startedAt.getTime() < stuckBefore).length;
    const lastFinished = mine.find((r) => r.finishedAt !== null) ?? null;
    const lastRunFailed = lastFinished?.ok === false;
    const noRecentSuccess = !lastSuccess || lastSuccess.getTime() < successAfter;
    const state: JobState = stuckRuns > 0 || lastRunFailed ? "failed" : noRecentSuccess ? "warning" : "ok";
    return { job, state, lastSuccess, lastRun: mine[0] ?? null, stuckRuns, noRecentSuccess, lastRunFailed };
  });
  const state: JobState = health.some((h) => h.state === "failed") ? "failed" : health.some((h) => h.state === "warning") ? "warning" : "ok";
  return { jobs: health, state };
}
