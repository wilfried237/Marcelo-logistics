import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { Illustration } from "@/components/brand/illustration";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "guide" });
  return { title: t("title"), description: t("intro") };
}

/**
 * General packing and preparation advice. The restricted-goods list is framed as
 * "ask us first"; the binding list for a shipment comes with the quote (S-03).
 */
export default async function ShippingGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("guide");
  const ill = await getTranslations("illustrations");

  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-16">
        <div className="max-w-5xl space-y-12">
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

        <section className="mt-14 border-l-4 border-warning bg-warning-soft p-6 md:p-8">
          <h2 className="text-2xl font-bold tracking-tight">{t("restrictedTitle")}</h2>
          <p className="mt-3">{t("restrictedBody")}</p>
          <ul className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {([1, 2, 3, 4, 5, 6] as const).map((n) => (
              <li key={n} className="border-b border-warning/20 py-2">
                {t(`restricted${n}`)}
              </li>
            ))}
          </ul>
          <p className="mt-5 font-semibold">{t("restrictedNote")}</p>
        </section>

        <section className="mt-14 grid gap-6 border-t pt-12 md:grid-cols-[2fr_1fr] md:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("customsTitle")}</h2>
            <p className="mt-3 text-muted-foreground">{t("customsBody")}</p>
          </div>
          <Button asChild size="lg" className="md:justify-self-end">
            <Link href="/quote">{t("cta")}</Link>
          </Button>
        </section>
      </div>
    </>
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
