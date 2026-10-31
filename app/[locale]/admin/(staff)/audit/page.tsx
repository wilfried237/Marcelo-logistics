import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { listAuditEntries } from "@/lib/services/users";
import { PageHeader } from "@/components/app/page-header";

export default async function AdminAudit({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/audit");
  const t = await getTranslations("admin.audit");
  const format = await getFormatter();
  const entries = await listAuditEntries(getDb(), user);
  return (
    <div className="space-y-6">
      <PageHeader title={(await getTranslations("admin"))("nav.audit")} description={t("intro")} />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">{t("intro")}</caption>
          <thead className="border-b bg-secondary/50">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("when")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("action")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("entity")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("actor")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2.5">{format.dateTime(new Date(e.at), { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {e.entity}/{e.entityId.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{e.actor ? e.actor.slice(0, 8) : t("system")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
