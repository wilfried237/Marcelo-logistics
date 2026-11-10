import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SERVICE_SECTIONS } from "@/config/catalogue";
import { SERVICE_OFFERINGS, type ServiceKey } from "@/lib/domain/services";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { PriceTable, PricingDisclosure } from "@/components/pricing/price-table";

/**
 * Services whose page shows the general collection, delivery and storage block.
 * Only parcels and personal effects, and barrels and cartons: the client's rules
 * (drop-off points, Dublin home collection, delivery in Cameroon, 48-hour storage)
 * are not confirmed for vehicles, full containers, warehousing or e-commerce (S-07).
 * The monthly departure schedule is not tied to any one service here: which
 * services the "express" departures cover is still open (S-02).
 */
const SHOWS_COLLECTION: readonly ServiceKey[] = ["barrels", "parcels"];
const MAX_LIST = 8;

function findService(key: string) {
  return SERVICE_OFFERINGS.find((s) => s.key === key);
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SERVICE_OFFERINGS.map((s) => ({ locale, service: s.key })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; service: string }> }) {
  const { locale, service } = await params;
  if (!findService(service)) return {};
  const t = await getTranslations({ locale });
  return { title: t(`services.${service}.title`), description: t(`serviceDetail.services.${service}.intro`) };
}

/**
 * One page per service: what is carried, options, guide prices from the
 * catalogue, conditions, collection and delivery, and what to put in a quote
 * request. Content is in messages ("serviceDetail.services.<key>"), prices in
 * config/catalogue.ts. Lists are numbered keys (what1, what2...) read until the
 * first missing one.
 */
export default async function ServiceDetailPage({ params }: { params: Promise<{ locale: string; service: string }> }) {
  const { locale, service: key } = await params;
  const service = findService(key);
  if (!service) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("serviceDetail");
  const ts = await getTranslations("services");
  const base = `services.${service.key}`;
  const list = (prefix: string) => Array.from({ length: MAX_LIST }, (_, i) => `${base}.${prefix}${i + 1}`).filter((k) => t.has(k)).map((k) => t(k));
  const sections = SERVICE_SECTIONS[service.key];
  const quoteHref = service.quoteCode ? { pathname: "/quote", query: { service: service.quoteCode } } : "/contact";

  return (
    <>
      <PageBanner title={ts(`${service.key}.title`)} description={t(`${base}.intro`)}>
        <Button asChild size="lg">
          <Link href={quoteHref}>{service.quoteCode ? t("quoteCta") : t("askCta")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/services">{t("allServices")}</Link>
        </Button>
      </PageBanner>
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-10">
            <ListSection title={t("whatTitle")} items={list("what")} />
            <ListSection title={t("optionsTitle")} items={list("option")} />
            <ListSection title={t("conditionsTitle")} items={list("condition")}>
              <Link href={{ pathname: "/shipping-guide", hash: "prohibited" }} className="mt-3 inline-block font-semibold text-primary underline-offset-4 hover:underline">
                {t("prohibitedCta")}
              </Link>
            </ListSection>
            {SHOWS_COLLECTION.includes(service.key) && <ListSection title={t("collectionTitle")} items={([1, 2, 3, 4] as const).map((n) => t(`collection${n}`))} />}
            <ListSection title={t("infoTitle")} items={list("info")} />
          </div>
          <div className="min-w-0 space-y-10">
            <h2 className="border-b pb-2 text-2xl font-bold tracking-tight">{t("pricesTitle")}</h2>
            {sections.length ? sections.map((section) => <PriceTable key={section} section={section} />) : <p className="text-muted-foreground">{t("noPrices")}</p>}
            <PricingDisclosure />
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={quoteHref}>{service.quoteCode ? t("quoteCta") : t("askCta")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/prices">{t("pricesCta")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ListSection({ title, items, children }: { title: string; items: string[]; children?: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="border-b pb-2 text-2xl font-bold tracking-tight">{title}</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-brand">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {children}
    </section>
  );
}
