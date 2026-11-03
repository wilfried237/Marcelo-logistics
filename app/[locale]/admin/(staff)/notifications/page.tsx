import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { getNotificationOverview } from "@/lib/services/cases";
import { Alert } from "@/components/app/alert";
import { PageHeader } from "@/components/app/page-header";

const COLUMNS = ["created", "template", "audience", "status", "attempts", "sent", "event"] as const;

/** Email outbox status and scheduled job runs. The internal inbox address is never shown. */
export default async function AdminNotifications({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/notifications");
  const t = await getTranslations("admin.notifications");
  const format = await getFormatter();
  const { emails, problems, jobs } = await getNotificationOverview(getDb(), user);
  const when = (d: Date | null) => (d ? format.dateTime(d, { dateStyle: "short", timeStyle: "short" }) : "–");
  return (
    <div className="space-y-8">
      <PageHeader title={(await getTranslations("admin"))("nav.notifications")} description={t("intro")} />
      {problems > 0 && <Alert variant="warning">{t("problems", { count: problems })}</Alert>}
      <section aria-labelledby="emails-heading" className="space-y-3">
        <h2 id="emails-heading" className="text-xl font-semibold">
          {t("emails")}
        </h2>
        <div className="overflow-x-auto border bg-card">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b bg-secondary/50">
              <tr>
                {COLUMNS.map((k) => (
                  <th key={k} scope="col" className="px-3 py-2 font-medium">
                    {t(`columns.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{when(e.createdAt)}</td>
                  <td className="px-3 py-2">{e.template}</td>
                  <td className="px-3 py-2">{e.audience}</td>
                  <td className={`px-3 py-2 font-medium ${["DEAD", "BOUNCED", "COMPLAINED", "FAILED"].includes(e.status) ? "text-destructive" : ""}`} title={e.error ?? undefined}>
                    {e.status}
                  </td>
                  <td className="px-3 py-2">{e.attempts}</td>
                  <td className="whitespace-nowrap px-3 py-2">{when(e.sentAt)}</td>
                  <td className="px-3 py-2">{e.lastEvent ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="jobs-heading" className="space-y-3">
        <h2 id="jobs-heading" className="text-xl font-semibold">
          {t("jobs")}
        </h2>
        <ul className="divide-y border bg-card text-sm">
          {jobs.length === 0 && <li className="p-3 text-muted-foreground">{t("noJobs")}</li>}
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap justify-between gap-2 p-3">
              <span className="font-medium">{j.job}</span>
              <span className="text-muted-foreground">{when(j.startedAt)}</span>
              <span className={j.ok === false ? "font-semibold text-destructive" : ""}>{j.ok === null ? t("running") : j.ok ? t("ok") : `${t("failed")}: ${j.error ?? ""}`}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
