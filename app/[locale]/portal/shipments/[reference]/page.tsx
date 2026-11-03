import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageUser } from "@/lib/auth/page-user";
import { getCustomerShipment } from "@/lib/services/shipments";
import { MilestoneTimeline } from "@/components/app/milestone-timeline";
import { PageHeader } from "@/components/app/page-header";
import { ShipmentStatusBadge } from "@/components/app/status-badge";
import { MessageForm } from "@/components/quote/case-forms";
import { reportIssueAction } from "../../actions";

export default async function PortalShipmentDetail({ params }: { params: Promise<{ locale: string; reference: string }> }) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const user = await pageUser(locale, `/portal/shipments/${reference}`);
  const shipment = await getCustomerShipment(getDb(), user, reference);
  if (!shipment) notFound();
  const t = await getTranslations("trackPage");
  const tv = await getTranslations("quoteView");
  const tp = await getTranslations("portal");
  const ts = await getTranslations("services");
  const format = await getFormatter();
  return (
    <div className="space-y-8">
      <PageHeader title={shipment.reference} description={ts(`${shipment.serviceCode}.title`)} actions={<ShipmentStatusBadge status={shipment.status} />} />
      {shipment.etaFrom && shipment.etaTo && (
        <p>
          <span className="text-muted-foreground">{t("eta")}: </span>
          <span className="font-medium">
            {t("etaRange", { from: format.dateTime(new Date(shipment.etaFrom), { dateStyle: "medium" }), to: format.dateTime(new Date(shipment.etaTo), { dateStyle: "medium" }) })}
          </span>
        </p>
      )}
      <section aria-labelledby="history" className="space-y-4">
        <h2 id="history" className="text-xl font-semibold">
          {t("historyTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {tp("shipmentDetail.publicNote")} {t("timezoneNote")}
        </p>
        {shipment.events.length ? <MilestoneTimeline events={shipment.events} /> : <p className="text-muted-foreground">{t("noEvents")}</p>}
      </section>
      <section aria-labelledby="issue" className="space-y-3 border-t pt-6">
        <h2 id="issue" className="text-xl font-semibold">
          {tv("issueTitle")}
        </h2>
        <MessageForm action={reportIssueAction} locale={locale} hidden={{ reference: shipment.reference }} label={tv("issueLabel")} hint={tv("issueHint")} submit={tv("sendIssue")} />
      </section>
      <p className="text-sm">
        <Link href={`/portal/quotes/${shipment.quoteReference}`} className="font-medium text-primary underline-offset-4 hover:underline">
          {shipment.quoteReference}
        </Link>
      </p>
    </div>
  );
}
