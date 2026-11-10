import { getTranslations, setRequestLocale } from "next-intl/server";
import { ownerConfig } from "@/config/owner";
import { quoteSubmissionStatus } from "@/lib/config/env";
import { Alert } from "@/components/app/alert";
import { Container } from "@/components/app/page-header";
import { PageBanner } from "@/components/app/page-banner";
import { ContactChannels } from "@/components/contact/contact-channels";
import { QuoteWizard } from "@/components/quote/quote-wizard";
import { isServiceCode } from "@/lib/domain/services";
import { isSelectableFor } from "@/lib/domain/catalogue";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "quote" }))("hero.title") };
}

// Availability depends on runtime configuration, so this page is rendered per request.
export const dynamic = "force-dynamic";

export default async function QuotePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  // Optional pre-selection from service and price links; anything unknown is ignored.
  const query = await searchParams;
  const service = typeof query.service === "string" && isServiceCode(query.service) ? query.service : undefined;
  const item = service && typeof query.item === "string" && isSelectableFor(service, query.item) ? query.item : undefined;
  setRequestLocale(locale);
  const t = await getTranslations("quote");
  const available = quoteSubmissionStatus().available;

  return (
    <>
      <PageBanner title={t("hero.title")} description={t("hero.subtitle")} />
      <Container size="narrow" className="py-10 md:py-14">
        {!available && (
          <div className="mb-8 space-y-4">
            <Alert variant="warning" title={t("unavailable.title")}>
              <p>{t("unavailable.body")}</p>
            </Alert>
            <ContactChannels />
          </div>
        )}
        <div>
          <QuoteWizard
            available={available}
            routes={ownerConfig.operations.routes.map(({ origin, destination }) => ({ origin, destination }))}
            confirmedServices={[...ownerConfig.operations.confirmedServices]}
            initialService={service}
            initialItem={item}
          />
        </div>
      </Container>
    </>
  );
}
