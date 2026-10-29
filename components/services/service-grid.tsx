import { useTranslations } from "next-intl";
import { Car, Container, Package, Plane, Ship, Warehouse, type LucideIcon } from "lucide-react";
import { SERVICE_CODES, isServiceConfirmed, type ServiceCode } from "@/lib/domain/services";
import { cn } from "@/lib/utils";

export const SERVICE_ICONS: Record<ServiceCode, LucideIcon> = {
  parcels: Package,
  barrels: Container,
  air_freight: Plane,
  sea_freight: Ship,
  vehicle: Car,
  commercial_cargo: Warehouse,
};

export function ServiceGrid({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {SERVICE_CODES.map((code) => {
        const Icon = SERVICE_ICONS[code];
        return (
          <li key={code} className="rounded-lg border bg-background p-5">
            <Icon className="h-7 w-7 text-primary" aria-hidden />
            <h3 className="mt-4 font-semibold">{t(`services.${code}.title`)}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t(`services.${code}.description`)}</p>
            {!isServiceConfirmed(code) && (
              <p className="mt-3 inline-block rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {t("home.services.availability")}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
