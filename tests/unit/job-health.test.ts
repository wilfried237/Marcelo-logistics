import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NO_SUCCESS_WARNING_HOURS, SCHEDULED_JOBS, STUCK_AFTER_MINUTES, evaluateJobHealth, type JobRunRecord } from "@/lib/domain/job-health";

const now = new Date("2026-11-13T12:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const run = (job: string, startedMinutesAgo: number, ok: boolean | null, durationMinutes = 1): JobRunRecord => ({
  job,
  startedAt: ago(startedMinutesAgo),
  finishedAt: ok === null ? null : ago(startedMinutesAgo - durationMinutes),
  ok,
});
const healthy = (job: string) => run(job, 60, true);
const one = (runs: JobRunRecord[], job = "process-emails") => evaluateJobHealth(runs, now).jobs.find((j) => j.job === job)!;

describe("scheduled job health", () => {
  it("covers exactly the jobs Vercel schedules", () => {
    const crons = (JSON.parse(readFileSync("vercel.json", "utf8")).crons as { path: string }[]).map((c) => c.path.replace("/api/cron/", "")).sort();
    expect([...SCHEDULED_JOBS].sort()).toEqual(crons);
  });

  it("reports normal daily runs as healthy, with no false alarm for a run in progress", () => {
    const runs = [healthy("expire-quotes"), healthy("process-emails"), run("process-emails", 5, null)];
    expect(evaluateJobHealth(runs, now)).toMatchObject({ state: "ok" });
    expect(one(runs)).toMatchObject({ state: "ok", stuckRuns: 0, noRecentSuccess: false, lastRunFailed: false, lastSuccess: ago(59) });
    // A success 35 hours ago is still within the window.
    expect(evaluateJobHealth([run("expire-quotes", 35 * 60, true), run("process-emails", 35 * 60, true)], now).state).toBe("ok");
  });

  it(`flags a run still unfinished after ${STUCK_AFTER_MINUTES} minutes`, () => {
    expect(one([healthy("process-emails"), run("process-emails", STUCK_AFTER_MINUTES, null)]).stuckRuns).toBe(0); // exactly 15 minutes: not yet
    const stuck = one([healthy("process-emails"), run("process-emails", STUCK_AFTER_MINUTES + 1, null)]);
    expect(stuck).toMatchObject({ state: "failed", stuckRuns: 1 });
    expect(evaluateJobHealth([healthy("expire-quotes"), healthy("process-emails"), run("process-emails", 120, null)], now).state).toBe("failed");
  });

  it(`warns when a job has not succeeded for ${NO_SUCCESS_WARNING_HOURS} hours, or never ran`, () => {
    const stale = one([run("process-emails", NO_SUCCESS_WARNING_HOURS * 60 + 30, true)]);
    expect(stale).toMatchObject({ state: "warning", noRecentSuccess: true });
    expect(one([], "expire-quotes")).toMatchObject({ state: "warning", lastSuccess: null, lastRun: null });
    expect(evaluateJobHealth([healthy("process-emails")], now).state).toBe("warning"); // expire-quotes never ran
  });

  it("reports a failed last run as a problem even after an earlier success", () => {
    expect(one([run("process-emails", 600, true), run("process-emails", 30, false)])).toMatchObject({ state: "failed", lastRunFailed: true, noRecentSuccess: false });
    // A later success clears it.
    expect(one([run("process-emails", 600, false), run("process-emails", 30, true)])).toMatchObject({ state: "ok", lastRunFailed: false });
  });

  it("ignores runs of jobs that are not scheduled", () => {
    expect(evaluateJobHealth([healthy("expire-quotes"), healthy("process-emails"), run("retention-dry-run", 5000, false)], now).state).toBe("ok");
  });
});
