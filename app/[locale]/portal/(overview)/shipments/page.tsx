import { getTranslations, setRequestLocale } from "next-intl/server";
import { Package } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { pageUser } from "@/lib/auth/page-user";
import { listCustomerShipments } from "@/lib/services/shipments";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ShipmentList } from "@/components/app/record-lists";

export default async function PortalShipments({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageUser(locale, "/portal/shipments");
  const t = await getTranslations("portal");
  const shipments = await listCustomerShipments(getDb(), user);
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.shipments")} />
      {shipments.length ? <ShipmentList items={shipments} hrefBase="/portal/shipments" /> : <EmptyState icon={Package} title={t("noShipments")} description={t("noShipmentsBody")} />}
    </div>
  );
}
