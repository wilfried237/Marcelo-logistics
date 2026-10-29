import { getTranslations, setRequestLocale } from "next-intl/server";
import { ownerConfig } from "@/config/owner";
import { quoteSubmissionStatus } from "@/lib/config/env";
import { Alert } from "@/components/app/alert";
import { Container, PageHeader } from "@/components/app/page-header";
import { ContactChannels } from "@/components/contact/contact-channels";
import { QuoteWizard } from "@/components/quote/quote-wizard";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "quote" }))("hero.title") };
}

// Availability depends on runtime configuration, so this page is rendered per request.
export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quote");
  const available = quoteSubmissionStatus().available;

  return (
    <Container size="narrow" className="py-10 md:py-14">
      <PageHeader title={t("hero.title")} description={t("hero.subtitle")} />
      {!available && (
        <div className="mt-6 space-y-4">
          <Alert variant="warning" title={t("unavailable.title")}>
            <p>{t("unavailable.body")}</p>
          </Alert>
          <ContactChannels />
        </div>
      )}
      <div className="mt-8">
        <QuoteWizard
          available={available}
          originCountries={[...ownerConfig.operations.originCountries]}
          destinationCountries={[...ownerConfig.operations.destinationCountries]}
          confirmedServices={[...ownerConfig.operations.confirmedServices]}
        />
      </div>
    </Container>
  );
}
