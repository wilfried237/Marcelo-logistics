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

/** One illustration per "How it works" step (home.process.step1..4). */
const PROCESS_STEPS = ["requestQuote", "teamReview", "quoteReceived", "tracking"] as const satisfies readonly IllustrationName[];

const TASKS = [
  { key: "quote", href: "/quote" },
  { key: "track", href: "/track" },
  { key: "prepare", href: "/shipping-guide" },
  { key: "contact", href: "/contact" },
] as const;

/**
 * Home page organised around customer journeys: what we do, track, request a
 * quote, services, how it works, preparing goods, help and contact.
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
      {/* Hero: message and primary action beside a real photograph. */}
      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
          <div className="order-2 px-4 pt-10 pb-20 md:px-6 md:pt-14 lg:order-1 lg:py-20 lg:pr-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">{t("hero.eyebrow")}</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{t("hero.title")}</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/quote">{t("hero.quoteCta")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-ink-foreground/50 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
                <Link href="/how-it-works">{t("hero.secondaryCta")}</Link>
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

      {/* Tracking: the most frequent task gets its own prominent panel. */}
      <section aria-labelledby="track-heading" className="relative z-10 mx-auto -mt-10 max-w-7xl px-4 md:px-6">
        <div className="border-t-4 border-brand bg-card p-6 shadow-xl md:p-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr] lg:items-center">
            <div>
              <h2 id="track-heading" className="text-2xl font-bold tracking-tight">
                {t("hero.trackCta")}
              </h2>
              <p className="mt-1 text-muted-foreground">{t("tasks.trackBody")}</p>
            </div>
            <TrackSearch locale={locale} />
          </div>
        </div>
      </section>

      <section aria-labelledby="schedule-heading" className="mx-auto max-w-7xl px-4 pt-16 md:px-6 md:pt-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:items-center">
          <div>
            <h2 id="schedule-heading" className="text-3xl font-bold tracking-tight">
              {schedule("heading")}
            </h2>
            <p className="mt-3 text-muted-foreground">{schedule("intro")}</p>
            <Illustration name="routeMap" alt={ill("routeMap")} className="mt-6 max-w-xs" />
          </div>
          <DepartureSchedule />
        </div>
      </section>

      <section aria-labelledby="tasks-heading" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <h2 id="tasks-heading" className="text-3xl font-bold tracking-tight">
          {t("tasks.heading")}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TASKS.map(({ key, href }) => (
            <li key={key}>
              <Link href={href} className="group flex h-full flex-col border border-t-4 border-t-primary bg-card p-6 transition-colors hover:bg-secondary">
                <span className="text-lg font-semibold text-foreground group-hover:text-primary group-hover:underline">{t(`tasks.${key}Title`)}</span>
                <span className="mt-2 text-muted-foreground">{t(`tasks.${key}Body`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="services-heading" className="border-t bg-secondary">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <h2 id="services-heading" className="text-3xl font-bold tracking-tight">
                {t("services.heading")}
              </h2>
              <p className="mt-3 text-muted-foreground">{t("services.intro")}</p>
            </div>
            <Link href="/services" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t("services.viewAll")}
            </Link>
          </div>
          <ServiceGrid className="mt-8" />
        </div>
      </section>

      {/* How it works: the customer journey as a sequence of illustrations. */}
      <section aria-labelledby="process-heading" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
        <h2 id="process-heading" className="text-3xl font-bold tracking-tight">
          {t("process.heading")}
        </h2>
        <ol className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((illustration, i) => (
            <li key={illustration}>
              <Illustration name={illustration} alt={ill(illustration)} className="max-w-[240px] sm:max-w-[300px]" />
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
        <Button asChild variant="outline" className="mt-10">
          <Link href="/how-it-works">{t("hero.secondaryCta")}</Link>
        </Button>
      </section>

      <section aria-labelledby="guide-heading" className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-6 md:py-20 lg:grid-cols-2">
          <div>
            <h2 id="guide-heading" className="text-3xl font-bold tracking-tight">
              {t("guide.heading")}
            </h2>
            <p className="mt-3 text-ink-muted">{t("guide.body")}</p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/shipping-guide">{t("guide.cta")}</Link>
            </Button>
            <Illustration name="packParcel" alt={ill("packParcel")} className="mt-10 max-w-xs" />
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
            {([6, 1, 3] as const).map((n) => (
              <details key={n} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {faq(`q${n}`)}
                  <span className="text-xl leading-none text-primary transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted-foreground">{faq(`a${n}`)}</p>
              </details>
            ))}
          </div>
          <Link href="/faq" className="mt-6 inline-block font-semibold text-primary underline-offset-4 hover:underline">
            {t("faq.more")}
          </Link>
        </div>
      </section>

      <section className="border-t bg-secondary">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-6">
          <Illustration name="supportChat" alt={ill("supportChat")} className="hidden w-48 shrink-0 md:block" />
          <div className="max-w-2xl md:flex-1">
            <h2 className="text-3xl font-bold tracking-tight">{t("final.heading")}</h2>
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
