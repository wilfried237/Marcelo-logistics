import { getTranslations, setRequestLocale } from "next-intl/server";
import { Package } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { SHIPMENT_STATUSES, type ShipmentStatus } from "@/lib/domain/enums";
import { listShipmentsForStaff } from "@/lib/services/shipments";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { selectClassName } from "@/components/app/form-field";
import { PageHeader } from "@/components/app/page-header";
import { ShipmentList } from "@/components/app/record-lists";

export default async function AdminShipments({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; q?: string; sort?: string }> }) {
  const { locale } = await params;
  const { status: raw, q, sort: rawSort } = await searchParams;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/shipments");
  const t = await getTranslations("admin");
  const tl = await getTranslations("admin.list");
  const tsh = await getTranslations("status.shipment");
  const status = (SHIPMENT_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as ShipmentStatus) : undefined;
  const sort = rawSort === "oldest" ? "oldest" : "updated";
  const search = typeof q === "string" ? q.slice(0, 120) : "";
  const shipments = await listShipmentsForStaff(getDb(), user, { status, q: search || undefined, sort });
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.shipments")} />
      <form method="get" role="search" className="flex flex-wrap items-end gap-2">
        <label htmlFor="q" className="sr-only">
          {tl("search")}
        </label>
        <input id="q" name="q" type="search" defaultValue={search} placeholder={tl("shipmentSearchPlaceholder")} maxLength={120} className={`${selectClassName} w-72 max-w-full`} />
        <label htmlFor="status" className="sr-only">
          {t("filter")}
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={`${selectClassName} w-auto`}>
          <option value="">{t("filterAll")}</option>
          {SHIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tsh(s)}
            </option>
          ))}
        </select>
        <label htmlFor="sort" className="sr-only">
          {tl("sort")}
        </label>
        <select id="sort" name="sort" defaultValue={sort} className={`${selectClassName} w-auto`}>
          <option value="updated">{tl("updated")}</option>
          <option value="oldest">{tl("oldest")}</option>
        </select>
        <Button type="submit" variant="outline">
          {t("filter")}
        </Button>
      </form>
      {shipments.length ? <ShipmentList items={shipments} hrefBase="/admin/shipments" /> : <EmptyState icon={Package} title={t("noShipments")} />}
    </div>
  );
}
