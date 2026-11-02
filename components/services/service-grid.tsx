import { useTranslations } from "next-intl";
import { SERVICE_CODES, isServiceConfirmed } from "@/lib/domain/services";
import { cn } from "@/lib/utils";

/** Service cards: typography and a logo-blue top rule, no decorative icons. */
export function ServiceGrid({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <ul className={cn("grid gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-3", className)}>
      {SERVICE_CODES.map((code) => (
        <li key={code} className="flex flex-col bg-background p-6">
          <span className="block h-1 w-10 bg-brand" aria-hidden />
          <h3 className="mt-4 text-lg font-semibold">{t(`services.${code}.title`)}</h3>
          <p className="mt-2 flex-1 text-muted-foreground">{t(`services.${code}.description`)}</p>
          {!isServiceConfirmed(code) && <p className="mt-4 text-sm font-medium text-accent-foreground">{t("home.services.availability")}</p>}
        </li>
      ))}
    </ul>
  );
}
