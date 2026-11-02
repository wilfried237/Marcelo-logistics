import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { RouteIllustration } from "@/components/brand/illustrations";
import { PHOTOS, Photo } from "@/components/brand/photos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return { title: t("title"), description: t("intro") };
}

/** Only facts from the project brief; company history waits for the owner (B-02). */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");
  const nav = await getTranslations("nav");
  const media = await getTranslations("media");
  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 md:px-6">
        <section className="grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("howWeWorkTitle")}</h2>
            <p className="text-muted-foreground">{t("howWeWork")}</p>
            <p className="text-sm text-muted-foreground">{t("pendingDetails")}</p>
            <div className="flex flex-wrap gap-3 pt-3">
              <Button asChild>
                <Link href="/quote">{nav("quote")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">{nav("contact")}</Link>
              </Button>
            </div>
          </div>
          <RouteIllustration label={media("routeLabel")} from={media("ireland")} to={media("cameroon")} />
        </section>
        <section className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <Photo src={PHOTOS.yardLoading.src} alt={media(PHOTOS.yardLoading.altKey)} caption={media(PHOTOS.yardLoading.captionKey)} sizes="(min-width: 768px) 66vw, 100vw" className="border" imageClassName="aspect-[4/3]" />
          <Photo src={PHOTOS.sideLoader.src} alt={media(PHOTOS.sideLoader.altKey)} caption={media(PHOTOS.sideLoader.captionKey)} sizes="(min-width: 768px) 33vw, 100vw" className="self-start border" imageClassName="aspect-square" />
        </section>
      </div>
    </>
  );
}
