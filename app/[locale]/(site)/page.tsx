import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ServiceGrid } from "@/components/services/service-grid";
import { TrackSearch } from "@/components/tracking/track-search";
import { PHOTOS, Photo } from "@/components/brand/photos";
import { Illustration, type IllustrationName } from "@/components/brand/illustration";
import { DepartureSchedule } from "@/components/schedule/departure-schedule";
import { ContactChannels } from "@/components/contact/contact-channels";

/** One illustration per quote step (home.process.step1..4). */
const PROCESS_STEPS = ["requestQuote", "teamReview", "quoteReceived", "tracking"] as const satisfies readonly IllustrationName[];

/**
 * Home page, in the order a first-time visitor needs it: what the business
 * does, tracking, the full service offering, where the business is and when
 * shipments leave, how a quote works, packing, common questions, contact.
 */
export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const media = useTranslations("media");
  const ill = useTranslations("illustrations");
  const faq = useTranslations("faq");
  const guide = useTranslations("guide");
  const nav = useTranslations("nav");
  const schedule = useTranslations("schedule");

  return (
    <>
      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
          <div className="order-2 px-4 pt-10 pb-20 md:px-6 md:pt-14 lg:order-1 lg:py-20 lg:pr-12">
            <p className="text-sm font-medium text-brand">{t("hero.eyebrow")}</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{t("hero.title")}</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/quote">{t("hero.quoteCta")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-ink-foreground/50 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
                <Link href="/services">{t("services.viewAll")}</Link>
              </Button>
            </div>
          </div>
          <Photo
            src={PHOTOS.containerShip.src}
            alt={media(PHOTOS.containerShip.altKey)}
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority
            className="order-1 rounded-none bg-ink lg:order-2"
            imageClassName="aspect-[16/10] h-full lg:aspect-auto"
          />
        </div>
      </section>

      {/* Tracking: the most frequent task for existing customers. */}
      <section aria-labelledby="track-heading" className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 md:px-6">
        <div className="border-t-4 border-brand bg-card p-6 shadow-xl md:p-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr] lg:items-center">
            <div>
              <h2 id="track-heading" className="text-2xl font-bold tracking-tight">
                {t("hero.trackCta")}
              </h2>
              <p className="mt-1 text-muted-foreground">{t("trackIntro")}</p>
            </div>
            <TrackSearch locale={locale} />
          </div>
        </div>
      </section>

      <section aria-labelledby="services-heading" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <div className="max-w-3xl">
          <h2 id="services-heading" className="text-3xl font-bold tracking-tight">
            {t("services.heading")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("services.intro")}</p>
        </div>
        <ServiceGrid className="mt-10" />
        <Link href="/services" className="mt-8 inline-block font-semibold text-primary underline-offset-4 hover:underline">
          {t("services.viewAll")}
        </Link>
      </section>

      {/* Where the business is and when shipments leave each side. */}
      <section aria-labelledby="locations-heading" className="border-y bg-secondary">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:px-6 md:py-20 lg:grid-cols-2">
          <div>
            <h2 id="locations-heading" className="text-3xl font-bold tracking-tight">
              {t("locations.heading")}
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">{t("locations.intro")}</p>
            <ContactChannels className="mt-8" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">{schedule("heading")}</h3>
            <DepartureSchedule className="mt-4" />
            <p className="mt-3 text-sm text-muted-foreground">{schedule("askExact")}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="process-heading" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <h2 id="process-heading" className="text-3xl font-bold tracking-tight">
          {t("process.heading")}
        </h2>
        <ol className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((illustration, i) => (
            <li key={illustration}>
              <Illustration name={illustration} alt={ill(illustration)} className="max-w-[220px] sm:max-w-[260px]" />
              <div className="mt-5 flex items-baseline gap-3 border-t-2 border-brand pt-4">
                <span className="text-2xl font-bold leading-none text-brand" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="font-semibold">{t(`process.step${i + 1}Title`)}</h3>
              </div>
              <p className="mt-2 text-muted-foreground">{t(`process.step${i + 1}Body`)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/quote">{t("hero.quoteCta")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/how-it-works">{t("hero.secondaryCta")}</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="guide-heading" className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-6 md:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 id="guide-heading" className="text-3xl font-bold tracking-tight">
              {t("guide.heading")}
            </h2>
            <p className="mt-3 text-ink-muted">{t("guide.body")}</p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/shipping-guide">{t("guide.cta")}</Link>
            </Button>
          </div>
          <ul className="divide-y divide-ink-foreground/15 border-y border-ink-foreground/15">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="py-4 text-ink-foreground">
                {guide(`packing${n}`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:px-6 md:py-20 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("about.heading")}</h2>
          <p className="mt-3 text-muted-foreground">{t("about.body")}</p>
          <Link href="/about" className="mt-6 inline-block font-semibold text-primary underline-offset-4 hover:underline">
            {t("about.cta")}
          </Link>
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("faq.heading")}</h2>
          <div className="mt-6 divide-y border-y">
            {(["departures", "price", "currency"] as const).map((id) => (
              <details key={id} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {faq(`items.${id}.q`)}
                  <span className="text-xl leading-none text-primary transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted-foreground">{faq(`items.${id}.a`)}</p>
                {id === "departures" && <DepartureSchedule className="mt-4" />}
              </details>
            ))}
          </div>
          <Link href="/faq" className="mt-6 inline-block font-semibold text-primary underline-offset-4 hover:underline">
            {t("faq.more")}
          </Link>
        </div>
      </section>

      <section aria-labelledby="final-heading" className="border-t bg-secondary">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="max-w-2xl">
            <h2 id="final-heading" className="text-3xl font-bold tracking-tight">
              {t("final.heading")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("final.body")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/quote">{t("hero.quoteCta")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">{nav("contact")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
