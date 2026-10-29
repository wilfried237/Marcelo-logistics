import { getTranslations, setRequestLocale } from "next-intl/server";
import { Package } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { listShipmentsForStaff } from "@/lib/services/shipments";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ShipmentList } from "@/components/app/record-lists";

export default async function AdminShipments({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/shipments");
  const t = await getTranslations("admin");
  const shipments = await listShipmentsForStaff(getDb(), user);
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.shipments")} />
      {shipments.length ? <ShipmentList items={shipments} hrefBase="/admin/shipments" /> : <EmptyState icon={Package} title={t("noShipments")} />}
    </div>
  );
}
