import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ServiceGrid } from "@/components/services/service-grid";
import { ContactChannels } from "@/components/contact/contact-channels";

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const steps = [1, 2, 3, 4] as const;

  return (
    <>
      <section className="border-b bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">{t("hero.title")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/quote">{t("hero.quoteCta")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/track">{t("hero.trackCta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">{t("services.heading")}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("services.intro")}</p>
        <ServiceGrid className="mt-8" />
      </section>

      <section className="border-y bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">{t("process.heading")}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {steps.map((n) => (
              <li key={n} className="rounded-lg border bg-background p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-hidden>
                  {n}
                </span>
                <h3 className="mt-4 font-semibold">{t(`process.step${n}Title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`process.step${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{t("about.heading")}</h2>
          <p className="mt-3 text-muted-foreground">{t("about.body")}</p>
        </div>
        <ContactSummary />
      </section>
    </>
  );
}

function ContactSummary() {
  const t = useTranslations("contact");
  return (
    <div>
      <h2 className="text-3xl font-semibold tracking-tight">{t("title")}</h2>
      <p className="mt-3 mb-6 text-muted-foreground">{t("description")}</p>
      <ContactChannels />
    </div>
  );
}
