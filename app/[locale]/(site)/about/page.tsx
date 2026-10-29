import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Container, PageHeader } from "@/components/app/page-header";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "aboutPage" }))("title") };
}

/** Only facts from the project brief; company history waits for the owner (B-02). */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");
  const nav = await getTranslations("nav");
  return (
    <Container size="narrow" className="py-10 md:py-14">
      <PageHeader title={t("title")} description={t("intro")} />
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">{t("howWeWorkTitle")}</h2>
        <p className="text-muted-foreground">{t("howWeWork")}</p>
        <p className="text-sm text-muted-foreground">{t("pendingDetails")}</p>
      </section>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/quote">{nav("quote")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contact">{nav("contact")}</Link>
        </Button>
      </div>
    </Container>
  );
}
