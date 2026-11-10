import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CATALOGUE } from "@/config/catalogue";
import { ownerConfig } from "@/config/owner";
import { structuredPrice } from "@/lib/domain/catalogue";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { JsonLd } from "@/components/app/json-ld";
import { PriceTable, PricingDisclosure } from "@/components/pricing/price-table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricesPage" });
  return { title: t("title"), description: t("intro") };
}

/** Every guide price from the official catalogue (config/catalogue.ts), section by section. */
export default async function PricesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pricesPage");
  const c = await getTranslations("catalogue");

  return (
    <>
      <PageBanner title={t("title")} description={t("intro")}>
        <Button asChild size="lg">
          <Link href="/quote">{t("cta")}</Link>
        </Button>
      </PageBanner>
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav aria-labelledby="prices-toc" className="lg:sticky lg:top-24 lg:self-start">
            <h2 id="prices-toc" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("onThisPage")}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm lg:flex-col lg:gap-y-2.5">
              {CATALOGUE.map((section) => (
                <li key={section.key}>
                  <a href={`#${section.key}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {c(`sections.${section.key}.title`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0 max-w-4xl space-y-14">
            <PricingDisclosure />
            {CATALOGUE.map((section) => (
              <PriceTable key={section.key} section={section.key} headingLevel={2} />
            ))}
            <section className="flex flex-col gap-4 border-t pt-10 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{t("ctaTitle")}</h2>
                <p className="mt-1 text-muted-foreground">{t("ctaBody")}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/quote">{t("cta")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/shipping-guide">{t("guideCta")}</Link>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
      <PricesJsonLd />
    </>
  );
}

/**
 * An OfferCatalog of the published guide prices (items with no published price are
 * omitted). No machine-readable VAT assertion (valueAddedTaxIncluded) until legal
 * review approves that representation (L-11); the visible text is unchanged.
 */
async function PricesJsonLd() {
  const locale = await getLocale();
  const c = await getTranslations({ locale, namespace: "catalogue" });
  const offers = CATALOGUE.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.items.flatMap((item) => {
        const price = structuredPrice(item.price);
        if (!price) return [];
        const spec = price.price ? { "@type": "PriceSpecification", price: price.price, priceCurrency: price.priceCurrency } : { "@type": "PriceSpecification", ...price };
        return [{ "@type": "Offer", name: c(`items.${section.key}.${item.key}.label`), priceSpecification: spec }];
      }),
    ),
  );
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "OfferCatalog",
        name: (await getTranslations({ locale, namespace: "pricesPage" }))("title"),
        provider: { "@type": "Organization", name: "Marchelo Logistics", legalName: ownerConfig.company.legalName },
        itemListElement: offers,
      }}
    />
  );
}
