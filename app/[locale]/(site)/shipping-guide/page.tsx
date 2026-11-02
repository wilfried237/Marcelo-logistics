import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { PHOTOS, Photo } from "@/components/brand/photos";

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
  const media = await getTranslations("media");

  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-12">
            <Section title={t("packingTitle")}>
              <List items={([1, 2, 3, 4, 5, 6] as const).map((n) => t(`packing${n}`))} />
            </Section>
            <Section title={t("labelTitle")}>
              <List items={([1, 2, 3] as const).map((n) => t(`label${n}`))} />
            </Section>
            <Section title={t("listTitle")}>
              <p className="text-muted-foreground">{t("listBody")}</p>
            </Section>
          </div>
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <Photo src={PHOTOS.sideLoader.src} alt={media(PHOTOS.sideLoader.altKey)} caption={media(PHOTOS.sideLoader.captionKey)} sizes="(min-width: 1024px) 33vw, 100vw" className="mx-auto w-full max-w-sm rounded-none border" imageClassName="aspect-square" />
          </aside>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-b pb-3 text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-5">{children}</div>
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
