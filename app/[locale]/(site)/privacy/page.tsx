import { getTranslations, setRequestLocale } from "next-intl/server";
import { ownerConfig } from "@/config/owner";
import { Alert } from "@/components/app/alert";
import { Container } from "@/components/app/page-header";
import { PageBanner } from "@/components/app/page-banner";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "privacyPage" }))("title") };
}

const SECTIONS = ["collect", "use", "security", "cookies", "retention", "rights"] as const;

/**
 * Factual draft generated from what the code actually collects. The controller
 * identity and retention periods are owner/legal decisions (L-02, L-03); until
 * approved, the page says so and release builds stay blocked.
 */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacyPage");
  return (
    <>
      <PageBanner title={t("title")} />
      <Container size="narrow" className="py-10 md:py-14">
        {!ownerConfig.legal.privacyApproved && (
          <Alert variant="warning">
            {t("draftNotice")}
          </Alert>
        )}
        <div className="mt-8 space-y-8">
          {SECTIONS.map((key) => (
            <section key={key} className="space-y-2">
              <h2 className="text-xl font-semibold">{t(`${key}Title`)}</h2>
              <p className="text-muted-foreground">{t(key)}</p>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
