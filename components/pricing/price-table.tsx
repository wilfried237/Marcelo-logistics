import { useLocale, useTranslations } from "next-intl";
import type { CataloguePrice, CatalogueSectionKey } from "@/config/catalogue";
import { getSection, priceMessage, requiresQuotation } from "@/lib/domain/catalogue";
import { cn } from "@/lib/utils";

/**
 * Catalogue presentation, shared by the prices page, the service pages and the
 * quote form. Every price comes from config/catalogue.ts; nothing here holds or
 * derives an amount.
 */

/** A price as text, e.g. "From €1,400", "€50–€70" or "Individual quotation". */
export function usePriceText() {
  const t = useTranslations("catalogue.price");
  const locale = useLocale();
  return (price: CataloguePrice) => {
    const { key, values } = priceMessage(price, locale);
    return t(key, values);
  };
}

export function PriceLabel({ price, className }: { price: CataloguePrice; className?: string }) {
  const text = usePriceText();
  return <span className={cn("whitespace-nowrap font-semibold", requiresQuotation(price) ? "text-muted-foreground" : "text-foreground", className)}>{text(price)}</span>;
}

/** One catalogue section: grouped rows of item, examples and guide price, then the section notes. */
export function PriceTable({ section, headingLevel = 3, className }: { section: CatalogueSectionKey; headingLevel?: 2 | 3; className?: string }) {
  const t = useTranslations("catalogue");
  const data = getSection(section);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const GroupHeading = headingLevel === 2 ? "h3" : "h4";
  const showGroupHeadings = data.groups.length > 1;
  return (
    <section aria-labelledby={`prices-${section}`} className={cn("scroll-mt-24", className)} id={section}>
      <Heading id={`prices-${section}`} className={cn("font-bold tracking-tight", headingLevel === 2 ? "text-2xl md:text-3xl" : "text-xl")}>
        {t(`sections.${section}.title`)}
      </Heading>
      <p className="mt-1 text-muted-foreground">{t(`sections.${section}.intro`)}</p>
      <div className="mt-4 space-y-6">
        {data.groups.map((group) => (
          <div key={group.key}>
            {showGroupHeadings && <GroupHeading className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t(`groups.${group.key}`)}</GroupHeading>}
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{showGroupHeadings ? `${t(`sections.${section}.title`)}: ${t(`groups.${group.key}`)}` : t(`sections.${section}.title`)}</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">{t("tableItem")}</th>
                  <th scope="col">{t("tablePrice")}</th>
                </tr>
              </thead>
              <tbody className="border-t">
                {group.items.map((item) => (
                  <tr key={item.key} className="border-b align-top">
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <span className="block font-medium">{t(`items.${section}.${item.key}.label`)}</span>
                      {item.examples && (
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          <span className="sr-only">{t("examplesLabel")} </span>
                          {t(`items.${section}.${item.key}.examples`)}
                        </span>
                      )}
                      {item.clarification && <span className="mt-0.5 block text-sm text-accent-foreground">{t(`clarification.${item.clarification.replace("-", "")}`)}</span>}
                    </th>
                    <td className="py-3 text-right">
                      <PriceLabel price={item.price} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {data.notes > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          {Array.from({ length: data.notes }, (_, i) => (
            <li key={i} className="border-l-2 border-brand pl-3">
              {t(`sections.${section}.note${i + 1}`)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The standard pricing disclosure: EUR, VAT, guide prices only, written quotation is final. */
export function PricingDisclosure({ className }: { className?: string }) {
  const t = useTranslations("catalogue");
  return (
    <aside aria-labelledby="pricing-disclosure" className={cn("border-l-4 border-brand bg-secondary p-5 md:p-6", className)}>
      <h2 id="pricing-disclosure" className="text-lg font-semibold">
        {t("disclosureTitle")}
      </h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm marker:text-brand">
        {([1, 2, 3, 4] as const).map((n) => (
          <li key={n}>{t(`disclosure${n}`)}</li>
        ))}
      </ul>
    </aside>
  );
}
