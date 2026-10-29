import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageUser } from "@/lib/auth/page-user";
import { listCustomerQuoteRequests } from "@/lib/services/quote-requests";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { QuoteRequestList } from "@/components/app/record-lists";

export default async function PortalQuotes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageUser(locale, "/portal/quotes");
  const t = await getTranslations("portal");
  const requests = await listCustomerQuoteRequests(getDb(), user);
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.quotes")} />
      {requests.length ? (
        <QuoteRequestList items={requests} hrefBase="/portal/quotes" />
      ) : (
        <EmptyState
          icon={FileText}
          title={t("noQuotes")}
          description={t("noQuotesBody")}
          action={
            <Button asChild>
              <Link href="/quote">{t("requestQuote")}</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
