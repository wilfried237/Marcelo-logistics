import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileText, Package } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageUser } from "@/lib/auth/page-user";
import { listCustomerQuoteRequests } from "@/lib/services/quote-requests";
import { listCustomerShipments } from "@/lib/services/shipments";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/app/alert";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { QuoteRequestList, ShipmentList } from "@/components/app/record-lists";

export default async function PortalOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageUser(locale, "/portal");
  const t = await getTranslations("portal");
  const ts = await getTranslations("status.quote");
  const db = getDb();
  const [requests, shipments] = await Promise.all([listCustomerQuoteRequests(db, user), listCustomerShipments(db, user)]);
  const attention = requests.filter((r) => r.status === "QUOTED" || r.status === "AWAITING_CUSTOMER");
  const active = shipments.filter((s) => s.status !== "DELIVERED" && s.status !== "CANCELLED");

  return (
    <div className="space-y-10">
      <PageHeader
        title={t("welcome")}
        description={t("overviewIntro")}
        actions={
          <Button asChild>
            <Link href="/quote">{t("requestQuote")}</Link>
          </Button>
        }
      />
      {attention.length > 0 && (
        <section aria-labelledby="attention" className="space-y-3">
          <h2 id="attention" className="text-xl font-semibold">
            {t("attention")}
          </h2>
          {attention.map((r) => (
            <Alert key={r.reference} variant="warning">
              <Link href={`/portal/quotes/${r.reference}`} className="font-medium underline">
                {r.reference}
              </Link>{" "}
              · {ts(r.status)}
            </Alert>
          ))}
        </section>
      )}
      <section aria-labelledby="active" className="space-y-3">
        <h2 id="active" className="text-xl font-semibold">
          {t("activeShipments")}
        </h2>
        {active.length ? <ShipmentList items={active} hrefBase="/portal/shipments" /> : <EmptyState icon={Package} title={t("noShipments")} description={t("noShipmentsBody")} />}
      </section>
      <section aria-labelledby="recent" className="space-y-3">
        <h2 id="recent" className="text-xl font-semibold">
          {t("recentQuotes")}
        </h2>
        {requests.length ? (
          <QuoteRequestList items={requests.slice(0, 5)} hrefBase="/portal/quotes" />
        ) : (
          <EmptyState icon={FileText} title={t("noQuotes")} description={t("noQuotesBody")} />
        )}
      </section>
    </div>
  );
}
