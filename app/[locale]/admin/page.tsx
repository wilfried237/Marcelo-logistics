import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inbox } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { QUOTE_STATUSES } from "@/lib/domain/enums";
import { countQuoteRequestsByStatus, listQuoteRequestsForStaff } from "@/lib/services/quote-requests";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { QuoteRequestList } from "@/components/app/record-lists";

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin");
  const t = await getTranslations("admin");
  const ts = await getTranslations("status.quote");
  const db = getDb();
  const [counts, newest] = await Promise.all([countQuoteRequestsByStatus(db, user), listQuoteRequestsForStaff(db, user, { status: "SUBMITTED" })]);
  const byStatus = new Map(counts.map((c) => [c.status, c.count]));

  return (
    <div className="space-y-10">
      <PageHeader title={t("nav.dashboard")} description={t("dashboardIntro")} />
      <section aria-labelledby="counts">
        <h2 id="counts" className="mb-3 text-xl font-semibold">
          {t("counts")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUOTE_STATUSES.map((status) => (
            <li key={status}>
              <Link href={{ pathname: "/admin/quotes", query: { status } }} className="block rounded-lg border bg-card p-4 hover:bg-secondary/50">
                <span className="block text-2xl font-bold">{byStatus.get(status) ?? 0}</span>
                <span className="text-sm text-muted-foreground">{ts(status)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="new" className="space-y-3">
        <h2 id="new" className="text-xl font-semibold">
          {ts("SUBMITTED")}
        </h2>
        {newest.length ? <QuoteRequestList items={newest.slice(0, 10)} hrefBase="/admin/quotes" /> : <EmptyState icon={Inbox} title={t("noRequests")} />}
      </section>
    </div>
  );
}
