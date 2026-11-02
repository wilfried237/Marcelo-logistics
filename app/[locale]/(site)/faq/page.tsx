import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/app/page-header";
import { PageBanner } from "@/components/app/page-banner";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "faq" }))("title") };
}

const QUESTIONS = [1, 2, 3, 4, 5] as const;

/** Answers describe how the website works; no unverified business promises. */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <Container size="narrow" className="py-10 md:py-14">
        <div className="divide-y rounded-2xl border bg-card">
          {QUESTIONS.map((n) => (
            <details key={n} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {t(`q${n}`)}
                <span className="text-primary transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-muted-foreground">{t(`a${n}`)}</p>
            </details>
          ))}
        </div>
      </Container>
    </>
  );
}
