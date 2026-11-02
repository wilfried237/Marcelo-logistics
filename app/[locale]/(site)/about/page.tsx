import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
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
      <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 py-14 md:px-6 md:py-16 lg:grid-cols-[3fr_2fr]">
        <section>
          <h2 className="text-3xl font-bold tracking-tight">{t("howWeWorkTitle")}</h2>
          <p className="mt-3 text-lg text-muted-foreground">{t("howWeWork")}</p>
          <p className="mt-6 border-l-4 border-border pl-4 text-sm text-muted-foreground">{t("pendingDetails")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/quote">{nav("quote")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">{nav("contact")}</Link>
            </Button>
          </div>
        </section>
        <div className="grid gap-6">
          <Photo src={PHOTOS.yardLoading.src} alt={media(PHOTOS.yardLoading.altKey)} caption={media(PHOTOS.yardLoading.captionKey)} sizes="(min-width: 1024px) 40vw, 100vw" className="rounded-none border" imageClassName="aspect-[4/3]" />
          <Photo src={PHOTOS.sideLoader.src} alt={media(PHOTOS.sideLoader.altKey)} caption={media(PHOTOS.sideLoader.captionKey)} sizes="(min-width: 1024px) 300px, 100vw" className="w-full max-w-xs rounded-none border" imageClassName="aspect-square" />
        </div>
      </div>
    </>
  );
}
