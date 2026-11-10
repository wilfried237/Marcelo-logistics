import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { Illustration } from "@/components/brand/illustration";
import { DepartureSchedule } from "@/components/schedule/departure-schedule";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide" });
  return { title: t("title"), description: t("intro") };
}

const PROHIBITED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Customer information supplied by the client (Stage 3): rates, payment, VAT and
 * customs, collection and delivery, schedule, cancellations, prohibited goods,
 * plus packing advice. Contractual terms awaiting legal review (claims policy,
 * compensation limits, fees for prohibited goods; docs/legal/README.md) are
 * deliberately not published here.
 */
export default async function ShippingGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("guide");
  const p = await getTranslations("prohibited");
  const ill = await getTranslations("illustrations");
  const schedule = await getTranslations("schedule");

  const toc = [
    ["rates", t("ratesTitle")],
    ["payment", t("paymentTitle")],
    ["customs", t("customsTitle")],
    ["collection", t("collectionTitle")],
    ["schedule", t("scheduleTitle")],
    ["cancellations", t("cancelTitle")],
    ["prohibited", p("title")],
    ["packing", t("packingNav")],
  ] as const;

  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-16">
        <nav aria-labelledby="guide-toc" className="mb-12 border-b pb-6">
          <h2 id="guide-toc" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("onThisPage")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-4xl space-y-12">
          <InfoSection id="rates" title={t("ratesTitle")} items={[1, 2, 3, 4, 5].map((n) => t(`rates${n}`))}>
            <Link href="/prices" className="mt-4 inline-block font-semibold text-primary underline-offset-4 hover:underline">
              {t("pricesCta")}
            </Link>
          </InfoSection>
          <InfoSection id="payment" title={t("paymentTitle")} items={[1, 2, 3, 4, 5].map((n) => t(`payment${n}`))} />
          <InfoSection id="customs" title={t("customsTitle")} items={[1, 2, 3, 4].map((n) => t(`customs${n}`))} />
          <InfoSection id="collection" title={t("collectionTitle")} items={[1, 2, 3, 4].map((n) => t(`collection${n}`))} />
          <section id="schedule" aria-labelledby="schedule-title" className="scroll-mt-24">
            <h2 id="schedule-title" className="border-b pb-3 text-2xl font-bold tracking-tight">
              {t("scheduleTitle")}
            </h2>
            <p className="mt-4 text-muted-foreground">{schedule("intro")}</p>
            <DepartureSchedule className="mt-4" />
          </section>
          <InfoSection id="cancellations" title={t("cancelTitle")} items={[1, 2, 3, 4].map((n) => t(`cancel${n}`))}>
            <p className="mt-4 text-sm text-muted-foreground">{t("cancelNote")}</p>
          </InfoSection>
        </div>

        <section id="prohibited" aria-labelledby="prohibited-title" className="mt-14 scroll-mt-24 border-l-4 border-warning bg-warning-soft p-6 md:p-8">
          <h2 id="prohibited-title" className="text-2xl font-bold tracking-tight">
            {p("title")}
          </h2>
          <p className="mt-3">{p("intro")}</p>
          <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
            {PROHIBITED.map((n) => (
              <li key={n} className="border-b border-warning/20 py-2">
                {p(`item${n}`)}
              </li>
            ))}
          </ul>
          <p className="mt-5 font-semibold">{p("disclaimer")}</p>
        </section>

        <div id="packing" className="mt-14 max-w-5xl scroll-mt-24 space-y-12">
          <Section title={t("packingTitle")} illustration={<Illustration name="guidePacking" alt={ill("guidePacking")} />}>
            <List items={([1, 2, 3, 4, 5, 6] as const).map((n) => t(`packing${n}`))} />
          </Section>
          <Section title={t("labelTitle")} illustration={<Illustration name="guideLabelling" alt={ill("guideLabelling")} />}>
            <List items={([1, 2, 3] as const).map((n) => t(`label${n}`))} />
          </Section>
          <Section title={t("listTitle")} illustration={<Illustration name="guideList" alt={ill("guideList")} />}>
            <p className="text-muted-foreground">{t("listBody")}</p>
          </Section>
        </div>

        <section className="mt-14 flex flex-col gap-4 border-t pt-12 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild size="lg">
            <Link href="/quote">{t("cta")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/prices">{t("pricesCta")}</Link>
          </Button>
        </section>
      </div>
    </>
  );
}

function InfoSection({ id, title, items, children }: { id: string; title: string; items: string[]; children?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="border-b pb-3 text-2xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-4">
        <List items={items} />
        {children}
      </div>
    </section>
  );
}

/** A guide section with a small instructional illustration beside its text. */
function Section({ title, illustration, children }: { title: string; illustration: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-b pb-3 text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-5 grid gap-6 sm:grid-cols-[1fr_200px] sm:items-start">
        <div>{children}</div>
        <div className="row-start-1 max-w-[200px] sm:col-start-2">{illustration}</div>
      </div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2.5 pl-5 marker:text-brand">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
