import { useLocale, useTranslations } from "next-intl";
import { ownerConfig } from "@/config/owner";
import { cn } from "@/lib/utils";

/**
 * Monthly departure windows per route, rendered from config/owner.ts (the only
 * place the days are stored). Departure windows only: no transit or delivery times.
 */
export function DepartureSchedule({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const t = useTranslations("schedule");
  const locale = useLocale();
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const country = (code: string) => names.of(code) ?? code;
  return (
    <ul className={cn("grid gap-px overflow-hidden border sm:grid-cols-2", tone === "dark" ? "border-ink-foreground/15 bg-ink-foreground/15" : "bg-border", className)}>
      {ownerConfig.operations.routes.map((route) => (
        <li key={`${route.origin}-${route.destination}`} className={cn("p-6", tone === "dark" ? "bg-ink" : "bg-card")}>
          <p className={cn("text-lg font-semibold", tone === "dark" ? "text-ink-foreground" : "text-foreground")}>
            {t("routeLabel", { origin: country(route.origin), destination: country(route.destination) })}
          </p>
          <p className={cn("mt-1", tone === "dark" ? "text-ink-muted" : "text-muted-foreground")}>
            {t("window", { from: route.departureDays.from, to: route.departureDays.to })}
          </p>
        </li>
      ))}
    </ul>
  );
}
