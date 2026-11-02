import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { ServiceGrid } from "@/components/services/service-grid";
import { PHOTOS, Photo } from "@/components/brand/photos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.services" });
  return { title: t("heading"), description: t("intro") };
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const nav2 = await getTranslations("nav2");
  const media = await getTranslations("media");
  return (
    <>
      <PageBanner title={t("services.heading")} description={t("services.intro")}>
        <Button asChild size="lg">
          <Link href="/quote">
            {t("hero.quoteCta")}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </PageBanner>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <ServiceGrid />
        <section className="mt-16 grid items-center gap-10 md:grid-cols-2">
          <Photo src={PHOTOS.yardLoading.src} alt={media(PHOTOS.yardLoading.altKey)} caption={media(PHOTOS.yardLoading.captionKey)} sizes="(min-width: 768px) 50vw, 100vw" className="border" imageClassName="aspect-[4/3]" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("guide.heading")}</h2>
            <p className="mt-3 text-muted-foreground">{t("guide.body")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/shipping-guide">{t("guide.cta")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/how-it-works">{nav2("howItWorks")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
