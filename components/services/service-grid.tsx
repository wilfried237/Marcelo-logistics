import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SERVICE_OFFERINGS, isServiceConfirmed, type ServiceOffering } from "@/lib/domain/services";
import { cn } from "@/lib/utils";

const GROUPS = ["shipping", "support"] as const;

/**
 * The full service offering in two groups (shipping; customs, storage and
 * shopping), as a ruled list rather than identical cards. With `actions`, each row
 * links to the quote form (services that can be quoted online) or to the
 * contact page (the others).
 */
export function ServiceGrid({ className, actions = false }: { className?: string; actions?: boolean }) {
  const t = useTranslations();
  return (
    <div className={cn("space-y-12", className)}>
      {GROUPS.map((group) => (
        <section key={group} aria-labelledby={`services-group-${group}`}>
          <h3 id={`services-group-${group}`} className="border-b-2 border-brand pb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t(`servicesPage.groups.${group}`)}
          </h3>
          <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_OFFERINGS.filter((s) => s.group === group).map((service) => (
              <ServiceRow key={service.key} service={service} actions={actions} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ServiceRow({ service, actions }: { service: ServiceOffering; actions: boolean }) {
  const t = useTranslations();
  const confirmed = isServiceConfirmed(service.key);
  return (
    <li className="border-b py-5">
      <h4 className="text-lg font-semibold">{t(`services.${service.key}.title`)}</h4>
      <p className="mt-1 text-muted-foreground">{t(`services.${service.key}.description`)}</p>
      {(actions || !confirmed) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {!confirmed && <span className="font-medium text-accent-foreground">{t("home.services.availability")}</span>}
          {actions &&
            (service.quoteCode ? (
              <Link href="/quote" className="font-semibold text-primary underline-offset-4 hover:underline">
                {t("servicesPage.quoteCta")}
              </Link>
            ) : (
              <Link href="/contact" className="font-semibold text-primary underline-offset-4 hover:underline">
                {t("servicesPage.askCta")}
              </Link>
            ))}
        </p>
      )}
    </li>
  );
}
