import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/app/page-header";
import { PageBanner } from "@/components/app/page-banner";
import { JsonLd } from "@/components/app/json-ld";
import { DepartureSchedule } from "@/components/schedule/departure-schedule";
import { ownerConfig } from "@/config/owner";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "faq" });
  return { title: t("title"), description: t("intro") };
}

/** Questions by topic; keys refer to "faq.items.<id>". Answers repeat client-supplied business rules only. */
const GROUPS = {
  rates: ["price", "currency", "individual"],
  payment: ["methods", "when", "xaf"],
  customs: ["customs"],
  collection: ["home", "delivery", "storage"],
  shipping: ["departures", "prohibited", "cancel", "delay"],
  website: ["account", "reference", "languages"],
} as const;

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("faq");
  const schedule = await getTranslations("schedule");
  const all = Object.values(GROUPS).flat();
  // Structured data must say what the page shows: the departures answer is followed
  // on the page by the schedule, so the windows are appended to that answer.
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const country = (code: string) => regions.of(code) ?? code;
  const windows = ownerConfig.operations.routes
    .map((r) => `${schedule("routeLabel", { origin: country(r.origin), destination: country(r.destination) })}: ${schedule("window", { from: r.departureDays.from, to: r.departureDays.to })}.`)
    .join(" ");
  const answer = (id: string) => (id === "departures" ? `${t(`items.${id}.a`)} ${windows} ${schedule("askExact")}` : t(`items.${id}.a`));

  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <Container size="narrow" className="space-y-10 py-10 md:py-14">
        {(Object.entries(GROUPS) as [keyof typeof GROUPS, readonly string[]][]).map(([group, ids]) => (
          <section key={group} aria-labelledby={`faq-${group}`}>
            <h2 id={`faq-${group}`} className="mb-3 text-xl font-semibold">
              {t(`groups.${group}`)}
            </h2>
            <div className="divide-y rounded-2xl border bg-card">
              {ids.map((id) => (
                <details key={id} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {t(`items.${id}.q`)}
                    <span className="text-primary transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-muted-foreground">{t(`items.${id}.a`)}</p>
                  {id === "departures" && (
                    <>
                      <DepartureSchedule className="mt-4" />
                      <p className="mt-3 text-sm text-muted-foreground">{schedule("askExact")}</p>
                    </>
                  )}
                  {id === "prohibited" && (
                    <Link href={{ pathname: "/shipping-guide", hash: "prohibited" }} className="mt-3 inline-block font-semibold text-primary underline-offset-4 hover:underline">
                      {t("guideLink")}
                    </Link>
                  )}
                  {(id === "price" || id === "home" || id === "storage") && (
                    <Link href="/prices" className="mt-3 inline-block font-semibold text-primary underline-offset-4 hover:underline">
                      {t("pricesLink")}
                    </Link>
                  )}
                </details>
              ))}
            </div>
          </section>
        ))}
      </Container>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: all.map((id) => ({ "@type": "Question", name: t(`items.${id}.q`), acceptedAnswer: { "@type": "Answer", text: answer(id) } })),
        }}
      />
    </>
  );
}
