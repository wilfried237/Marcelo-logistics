import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { normaliseReference } from "@/lib/domain/references";
import { Container } from "@/components/app/page-header";
import { PageBanner } from "@/components/app/page-banner";
import { TrackSearch } from "@/components/tracking/track-search";
import { Illustration } from "@/components/brand/illustration";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "track" }))("hero.title") };
}

export default async function TrackPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ reference?: string }> }) {
  const { locale } = await params;
  const { reference } = await searchParams;
  setRequestLocale(locale);
  if (typeof reference === "string" && reference.trim()) {
    const normalised = normaliseReference(reference).slice(0, 20).replace(/[^A-Z0-9]/g, "");
    if (normalised) redirect({ href: `/track/${normalised}`, locale });
  }
  const t = await getTranslations("track");
  const ill = await getTranslations("illustrations");
  return (
    <>
      <PageBanner title={t("hero.title")} description={t("hero.subtitle")} />
      <Container size="narrow" className="-mt-8 pb-14">
        <div className="relative rounded-2xl border bg-card p-5 shadow-lg md:p-8">
          <TrackSearch locale={locale} />
        </div>
        {/* Empty state only: kept small so it never competes with the form. */}
        <Illustration name="tracking" alt={ill("tracking")} className="mx-auto mt-10 max-w-[260px]" />
      </Container>
    </>
  );
}
