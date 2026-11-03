import { getTranslations, setRequestLocale } from "next-intl/server";
import { Inbox } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/domain/enums";
import { listQuoteRequestsForStaff } from "@/lib/services/quote-requests";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { selectClassName } from "@/components/app/form-field";
import { PageHeader } from "@/components/app/page-header";
import { QuoteRequestList } from "@/components/app/record-lists";

export default async function AdminQuotes({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; q?: string; sort?: string; assigned?: string }> }) {
  const { locale } = await params;
  const { status: raw, q, sort: rawSort, assigned: rawAssigned } = await searchParams;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/quotes");
  const t = await getTranslations("admin");
  const ts = await getTranslations("status.quote");
  const status = (QUOTE_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as QuoteStatus) : undefined;
  const sort = rawSort === "oldest" ? "oldest" : "newest";
  const assigned = rawAssigned === "me" || rawAssigned === "unassigned" ? rawAssigned : undefined;
  const search = typeof q === "string" ? q.slice(0, 120) : "";
  const requests = await listQuoteRequestsForStaff(getDb(), user, { status, q: search || undefined, sort, assigned });
  const tl = await getTranslations("admin.list");

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.quotes")} />
      <form method="get" role="search" className="flex flex-wrap items-end gap-2">
        <label htmlFor="q" className="sr-only">
          {tl("search")}
        </label>
        <input id="q" name="q" type="search" defaultValue={search} placeholder={tl("searchPlaceholder")} maxLength={120} className={`${selectClassName} w-64`} />
        <label htmlFor="status" className="sr-only">
          {t("filter")}
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={`${selectClassName} w-auto`}>
          <option value="">{t("filterAll")}</option>
          {QUOTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </select>
        <label htmlFor="assigned" className="sr-only">
          {tl("assigned")}
        </label>
        <select id="assigned" name="assigned" defaultValue={assigned ?? ""} className={`${selectClassName} w-auto`}>
          <option value="">{tl("assignedAny")}</option>
          <option value="me">{tl("assignedMe")}</option>
          <option value="unassigned">{tl("assignedNone")}</option>
        </select>
        <label htmlFor="sort" className="sr-only">
          {tl("sort")}
        </label>
        <select id="sort" name="sort" defaultValue={sort} className={`${selectClassName} w-auto`}>
          <option value="newest">{tl("newest")}</option>
          <option value="oldest">{tl("oldest")}</option>
        </select>
        <Button type="submit" variant="outline">
          {t("filter")}
        </Button>
      </form>
      {requests.length ? <QuoteRequestList items={requests} hrefBase="/admin/quotes" /> : <EmptyState icon={Inbox} title={t("noRequests")} />}
    </div>
  );
}
