import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { PHOTOS, Photo, photoProps } from "@/components/brand/photos";
import { Illustration } from "@/components/brand/illustration";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return { title: t("title"), description: t("intro") };
}

/**
 * Only facts from the project brief; company history waits for the owner (B-02).
 * The photograph shows the industry, not our premises, and no people are
 * presented as our staff.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");
  const nav = await getTranslations("nav");
  const media = await getTranslations("media");
  const ill = await getTranslations("illustrations");
  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <div className="mx-auto max-w-7xl px-4 pt-14 md:px-6 md:pt-16">
        <Photo {...photoProps(media, PHOTOS.portPanorama)} sizes="(min-width: 1280px) 1248px, 100vw" className="rounded-none border" imageClassName="aspect-[16/9] md:aspect-[21/9]" />
      </div>
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 md:px-6 md:py-16 lg:grid-cols-[3fr_2fr]">
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
        <Illustration name="connections" alt={ill("connections")} className="mx-auto max-w-md" />
      </div>
    </>
  );
}
