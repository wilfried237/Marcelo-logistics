import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Check, OctagonAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { PackingIllustration } from "@/components/brand/illustrations";
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
      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 md:px-6">
        <section className="grid items-start gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("packingTitle")}</h2>
            <CheckList items={([1, 2, 3, 4, 5, 6] as const).map((n) => t(`packing${n}`))} />
          </div>
          <PackingIllustration label={media("packingLabel")} />
        </section>

        <section className="grid gap-10 md:grid-cols-2">
          <div className="rounded-2xl border bg-background p-6">
            <h2 className="text-2xl font-semibold tracking-tight">{t("labelTitle")}</h2>
            <CheckList items={([1, 2, 3] as const).map((n) => t(`label${n}`))} />
          </div>
          <div className="rounded-2xl border bg-background p-6">
            <h2 className="text-2xl font-semibold tracking-tight">{t("listTitle")}</h2>
            <p className="mt-4 text-muted-foreground">{t("listBody")}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-warning/30 bg-warning-soft p-6 md:p-8">
          <div className="flex items-center gap-3">
            <OctagonAlert className="h-6 w-6 shrink-0 text-warning" aria-hidden />
            <h2 className="text-2xl font-semibold tracking-tight">{t("restrictedTitle")}</h2>
          </div>
          <p className="mt-3">{t("restrictedBody")}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {([1, 2, 3, 4, 5, 6] as const).map((n) => (
              <li key={n} className="rounded-lg bg-background/70 px-3 py-2 text-sm">
                {t(`restricted${n}`)}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-medium">{t("restrictedNote")}</p>
        </section>

        <section className="grid items-center gap-10 md:grid-cols-[1fr_2fr]">
          <Photo src={PHOTOS.sideLoader.src} alt={media(PHOTOS.sideLoader.altKey)} caption={media(PHOTOS.sideLoader.captionKey)} sizes="(min-width: 768px) 33vw, 100vw" className="border" imageClassName="aspect-square" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t("customsTitle")}</h2>
            <p className="mt-3 text-muted-foreground">{t("customsBody")}</p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/quote">
                {t("cta")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
