import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { QuoteStatus, ShipmentStatus } from "@/lib/domain/enums";

const QUOTE_TONE: Record<QuoteStatus, string> = {
  SUBMITTED: "bg-info-soft text-info",
  UNDER_REVIEW: "bg-info-soft text-info",
  AWAITING_CUSTOMER: "bg-warning-soft text-warning",
  QUOTED: "bg-accent text-accent-foreground",
  ACCEPTED: "bg-success-soft text-success",
  DECLINED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-danger-soft text-destructive",
};

const SHIPMENT_TONE: Record<ShipmentStatus, string> = {
  BOOKED: "bg-info-soft text-info",
  IN_TRANSIT: "bg-info-soft text-info",
  AT_DESTINATION: "bg-accent text-accent-foreground",
  DELIVERED: "bg-success-soft text-success",
  ON_HOLD: "bg-warning-soft text-warning",
  CANCELLED: "bg-danger-soft text-destructive",
};

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold";

/** The text label is always present; colour is supplementary, never the only signal. */
export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const t = useTranslations("status.quote");
  return <span className={cn(base, QUOTE_TONE[status])}>{t(status)}</span>;
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const t = useTranslations("status.shipment");
  return <span className={cn(base, SHIPMENT_TONE[status])}>{t(status)}</span>;
}
