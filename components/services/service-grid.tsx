import { useTranslations } from "next-intl";
import { SERVICE_CODES, isServiceConfirmed, type ServiceCode } from "@/lib/domain/services";
import { Illustration, type IllustrationName } from "@/components/brand/illustration";
import { cn } from "@/lib/utils";

const SERVICE_ILLUSTRATION: Record<ServiceCode, IllustrationName> = {
  parcels: "serviceParcels",
  barrels: "serviceBarrels",
  air_freight: "serviceAir",
  sea_freight: "serviceSea",
  vehicle: "serviceVehicle",
  commercial_cargo: "serviceCommercial",
};

/** Service cards: one spot illustration per service, then the title, description and availability. */
export function ServiceGrid({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <ul className={cn("grid gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-3", className)}>
      {SERVICE_CODES.map((code) => (
        <li key={code} className="flex flex-col bg-background p-6">
          <Illustration name={SERVICE_ILLUSTRATION[code]} alt={t(`illustrations.${SERVICE_ILLUSTRATION[code]}`)} className="max-w-[160px] sm:max-w-[200px]" />
          <h3 className="mt-4 text-lg font-semibold">{t(`services.${code}.title`)}</h3>
          <p className="mt-2 flex-1 text-muted-foreground">{t(`services.${code}.description`)}</p>
          {!isServiceConfirmed(code) && <p className="mt-4 text-sm font-medium text-accent-foreground">{t("home.services.availability")}</p>}
        </li>
      ))}
    </ul>
  );
}
