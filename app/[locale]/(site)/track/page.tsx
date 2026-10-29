import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { normaliseReference } from "@/lib/domain/references";
import { Container, PageHeader } from "@/components/app/page-header";
import { TrackSearch } from "@/components/tracking/track-search";

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
  return (
    <Container size="narrow" className="py-10 md:py-14">
      <PageHeader title={t("hero.title")} description={t("hero.subtitle")} />
      <div className="mt-8 rounded-xl border bg-card p-5 md:p-8">
        <TrackSearch locale={locale} />
      </div>
    </Container>
  );
}
