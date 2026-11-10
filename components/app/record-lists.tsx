import { useFormatter, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { QuoteStatus, ShipmentStatus } from "@/lib/domain/enums";
import type { ServiceCode } from "@/lib/domain/services";
import { findEntry } from "@/lib/domain/catalogue";
import { usePriceText } from "@/components/pricing/price-table";
import { QuoteStatusBadge, ShipmentStatusBadge } from "./status-badge";

/** Card list (works at 360 px); each row is one link with a descriptive name. */
export function QuoteRequestList({
  items,
  hrefBase,
}: {
  items: { reference: string; serviceCode: ServiceCode; status: QuoteStatus; createdAt: Date; destinationCity: string | null; customerName?: string }[];
  hrefBase: string;
}) {
  const ts = useTranslations("services");
  const format = useFormatter();
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <li key={item.reference}>
          <Link href={`${hrefBase}/${item.reference}`} className="flex items-center gap-4 p-4 hover:bg-secondary/50">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{item.reference}</span>
                <QuoteStatusBadge status={item.status} />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {item.customerName ? `${item.customerName} · ` : ""}
                {ts(`${item.serviceCode}.title`)}
                {item.destinationCity ? ` · ${item.destinationCity}` : ""} · {format.dateTime(new Date(item.createdAt), { dateStyle: "medium" })}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ShipmentList({
  items,
  hrefBase,
}: {
  items: { reference: string; serviceCode: ServiceCode; status: ShipmentStatus; updatedAt: Date; customerName?: string }[];
  hrefBase: string;
}) {
  const ts = useTranslations("services");
  const format = useFormatter();
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <li key={item.reference}>
          <Link href={`${hrefBase}/${item.reference}`} className="flex items-center gap-4 p-4 hover:bg-secondary/50">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{item.reference}</span>
                <ShipmentStatusBadge status={item.status} />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {item.customerName ? `${item.customerName} · ` : ""}
                {ts(`${item.serviceCode}.title`)} · {format.dateTime(new Date(item.updatedAt), { dateStyle: "medium" })}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Renders validated quote items (generic or vehicle) as a readable list. */
export function ItemsList({ items }: { items: unknown }) {
  const t = useTranslations("quoteForm");
  const tcat = useTranslations("catalogue");
  const priceText = usePriceText();
  const list = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  // Catalogue choice made by the customer (guidance only; requests from before Stage 3 have none).
  const catalogue = (item: Record<string, unknown>) => {
    const entry = typeof item.catalogueItem === "string" ? findEntry(item.catalogueItem) : undefined;
    if (!entry) return null;
    return (
      <span className="mt-1 block text-muted-foreground">
        {tcat(`items.${entry.section}.${entry.item.key}.label`)} · {t("guidePrice", { price: priceText(entry.item.price) })}
      </span>
    );
  };
  return (
    <ul className="space-y-2">
      {list.map((item, i) => (
        <li key={i} className="rounded-md border p-3 text-sm">
          {"vehicleMake" in item ? (
            <span>
              {String(item.vehicleMake)} {String(item.vehicleModel)} ({String(item.vehicleYear)}){item.running === false ? " · ✕" : ""}
              {item.description ? ` · ${String(item.description)}` : ""}
              {item.shippingMethod === "container" || item.shippingMethod === "roro" ? ` · ${t(item.shippingMethod === "roro" ? "vehicleMethodRoro" : "vehicleMethodContainer")}` : ""}
              {catalogue(item)}
            </span>
          ) : (
            <span>
              {String(item.quantity)} × {String(item.description)}
              {item.weightKg ? ` · ${t("weight")}: ${String(item.weightKg)}` : ""}
              {item.lengthCm && item.widthCm && item.heightCm ? ` · ${String(item.lengthCm)}×${String(item.widthCm)}×${String(item.heightCm)} cm` : ""}
              {catalogue(item)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
