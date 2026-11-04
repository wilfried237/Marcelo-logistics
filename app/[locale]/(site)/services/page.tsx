import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { ServiceGrid } from "@/components/services/service-grid";
import { PHOTOS, Photo, photoProps } from "@/components/brand/photos";
import { Illustration } from "@/components/brand/illustration";
import { DepartureSchedule } from "@/components/schedule/departure-schedule";

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
  const ill = await getTranslations("illustrations");
  const schedule = await getTranslations("schedule");
  return (
    <>
      <PageBanner title={t("services.heading")} description={t("services.intro")}>
        <Button asChild size="lg">
          <Link href="/quote">{t("hero.quoteCta")}</Link>
        </Button>
      </PageBanner>
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-16">
        <ServiceGrid />
        {/* Photographs of the industry by sea, air and warehouse (not our own facilities). */}
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {([PHOTOS.portUnloading, PHOTOS.airFreighter, PHOTOS.warehouse] as const).map((photo) => (
            <Photo key={photo.altKey} {...photoProps(media, photo)} sizes="(min-width: 768px) 33vw, 100vw" className="rounded-none border bg-background" imageClassName="aspect-[4/3]" />
          ))}
        </div>
        <section aria-labelledby="schedule-heading" className="mt-14">
          <h2 id="schedule-heading" className="text-3xl font-bold tracking-tight">
            {schedule("heading")}
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">{schedule("intro")}</p>
          <DepartureSchedule className="mt-6" />
        </section>
      </div>
      <section className="border-t bg-secondary">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:px-6 md:py-16">
          <Illustration name="containerLoading" alt={ill("containerLoading")} className="mx-auto max-w-md" />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t("guide.heading")}</h2>
            <p className="mt-3 text-muted-foreground">{t("guide.body")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/shipping-guide">{t("guide.cta")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/how-it-works">{nav2("howItWorks")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
