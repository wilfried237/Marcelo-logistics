import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { getNotificationOverview } from "@/lib/services/cases";
import { EMAIL_AUDIENCES, EMAIL_STATUSES, PROBLEM_STATUSES, listNotifications, type NotificationFilter } from "@/lib/services/notifications";
import { Alert } from "@/components/app/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { selectClassName } from "@/components/app/form-field";

const COLUMNS = ["created", "template", "audience", "record", "status", "attempts", "sent", "event"] as const;
type Search = { status?: string; template?: string; audience?: string; page?: string };

/**
 * Email outbox history and scheduled job runs. Read-only: emails are never
 * re-sent from here (D4). The internal inbox address and recipients are never shown.
 */
export default async function AdminNotifications({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/notifications");
  const raw = await searchParams;
  const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 64) : undefined);
  const filter: NotificationFilter = { status: one(raw.status), template: one(raw.template), audience: one(raw.audience), page: Number(one(raw.page) ?? 1) };
  const t = await getTranslations("admin.notifications");
  const format = await getFormatter();
  const db = getDb();
  const [list, { jobs }] = await Promise.all([listNotifications(db, user, filter), getNotificationOverview(db, user)]);
  const when = (d: Date | null) => (d ? format.dateTime(d, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Dublin" }) : "–");
  const query = (page: number) => {
    const p = new URLSearchParams();
    for (const k of ["status", "template", "audience"] as const) if (filter[k]) p.set(k, filter[k]!);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/admin/notifications${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader title={(await getTranslations("admin"))("nav.notifications")} description={t("intro")} />
      {list.problems > 0 && (
        <Alert variant="warning">
          {t("problems", { count: list.problems })}{" "}
          <Link href="/admin/notifications?status=DEAD" className="font-medium underline-offset-4 hover:underline">
            {t("showDead")}
          </Link>
        </Alert>
      )}
      <section aria-labelledby="emails-heading" className="space-y-3">
        <h2 id="emails-heading" className="text-xl font-semibold">
          {t("emails")}
        </h2>
        <form method="get" role="search" aria-label={t("filters")} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("columns.status")}</span>
            <select name="status" defaultValue={filter.status ?? ""} className={`${selectClassName} w-auto`}>
              <option value="">{t("all")}</option>
              {EMAIL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("columns.template")}</span>
            <select name="template" defaultValue={filter.template ?? ""} className={`${selectClassName} w-auto`}>
              <option value="">{t("all")}</option>
              {list.templates.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("columns.audience")}</span>
            <select name="audience" defaultValue={filter.audience ?? ""} className={`${selectClassName} w-auto`}>
              <option value="">{t("all")}</option>
              {EMAIL_AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {t(`audiences.${a}`)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">{t("apply")}</Button>
          <Link href="/admin/notifications" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("clear")}
          </Link>
        </form>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("count", { count: list.total })}
        </p>
        <div className="overflow-x-auto border bg-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="sr-only">{t("emails")}</caption>
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
              {list.emails.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{when(e.createdAt)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.template}</td>
                  <td className="px-3 py-2">{t(`audiences.${e.audience === "staff" ? "staff" : "customer"}`)}</td>
                  <td className="px-3 py-2">
                    {e.link ? (
                      <Link href={e.link.href} className="font-medium text-primary underline-offset-4 hover:underline">
                        {e.link.label}
                      </Link>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className={`px-3 py-2 font-medium ${(PROBLEM_STATUSES as readonly string[]).includes(e.status) ? "text-destructive" : ""}`} title={e.error ?? undefined}>
                    {t(`statuses.${e.status}`)}
                  </td>
                  <td className="px-3 py-2">{e.attempts}</td>
                  <td className="whitespace-nowrap px-3 py-2">{when(e.sentAt)}</td>
                  <td className="px-3 py-2">{e.lastEvent ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.emails.length && <p className="p-3 text-sm text-muted-foreground">{t("none")}</p>}
        </div>
        <nav aria-label={t("pagination")} className="flex flex-wrap items-center justify-between gap-3 text-sm">
          {list.page > 1 ? (
            <Link href={query(list.page - 1)} className="font-medium text-primary underline-offset-4 hover:underline">
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">{t("page", { page: list.page, pages: list.pages })}</span>
          {list.page < list.pages ? (
            <Link href={query(list.page + 1)} className="font-medium text-primary underline-offset-4 hover:underline">
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
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
