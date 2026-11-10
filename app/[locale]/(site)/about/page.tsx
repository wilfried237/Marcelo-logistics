import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { PHOTOS, Photo, photoProps } from "@/components/brand/photos";
import { ownerConfig } from "@/config/owner";
import { ContactChannels } from "@/components/contact/contact-channels";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return { title: t("title"), description: t("intro") };
}

/**
 * Only facts supplied by the client. The registration and VAT numbers were not
 * supplied (B-02) and are not shown until they are.
 * The photograph shows the industry, not our premises, and no people are
 * presented as our staff.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");
  const nav = await getTranslations("nav");
  const media = await getTranslations("media");
  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <div className="mx-auto max-w-7xl px-4 pt-14 md:px-6 md:pt-16">
        <Photo {...photoProps(media, PHOTOS.portPanorama)} sizes="(min-width: 1280px) 1248px, 100vw" className="rounded-none border" imageClassName="aspect-[16/9] md:aspect-[21/9]" />
      </div>
      <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 py-14 md:px-6 md:py-16 lg:grid-cols-[3fr_2fr]">
        <section>
          <h2 className="text-3xl font-bold tracking-tight">{t("howWeWorkTitle")}</h2>
          <p className="mt-3 text-lg text-muted-foreground">{t("howWeWork")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/quote">{nav("quote")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">{nav("contact")}</Link>
            </Button>
          </div>
        </section>
        <section aria-labelledby="where-heading">
          <h2 id="where-heading" className="text-3xl font-bold tracking-tight">
            {t("whereTitle")}
          </h2>
          <ContactChannels className="mt-6" />
          <h3 className="mt-10 text-xl font-semibold">{t("companyTitle")}</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">{t("legalEntity")}</dt>
            <dd className="font-medium">{ownerConfig.company.legalName}</dd>
            <dt className="text-muted-foreground">{t("tradingName")}</dt>
            <dd className="font-medium">{ownerConfig.company.tradingName}</dd>
          </dl>
        </section>
      </div>
    </>
  );
}
