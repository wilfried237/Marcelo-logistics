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

export default async function AdminQuotes({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  const { status: raw } = await searchParams;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/quotes");
  const t = await getTranslations("admin");
  const ts = await getTranslations("status.quote");
  const status = (QUOTE_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as QuoteStatus) : undefined;
  const requests = await listQuoteRequestsForStaff(getDb(), user, { status });

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.quotes")} />
      <form method="get" className="flex flex-wrap items-end gap-2">
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
        <Button type="submit" variant="outline">
          {t("filter")}
        </Button>
      </form>
      {requests.length ? <QuoteRequestList items={requests} hrefBase="/admin/quotes" /> : <EmptyState icon={Inbox} title={t("noRequests")} />}
    </div>
  );
}
