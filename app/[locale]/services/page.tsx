import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ServiceGrid } from "@/components/services/service-grid";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.services" });
  return { title: t("heading") };
}

export default function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <h1 className="text-4xl font-bold tracking-tight">{t("services.heading")}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("services.intro")}</p>
      <ServiceGrid className="mt-8" />
      <Button asChild size="lg" className="mt-10">
        <Link href="/quote">{t("hero.quoteCta")}</Link>
      </Button>
    </div>
  );
}
