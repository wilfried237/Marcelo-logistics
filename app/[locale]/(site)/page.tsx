import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ArrowRight, ClipboardCheck, Languages, PackageSearch, UserRoundCheck, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ServiceGrid } from "@/components/services/service-grid";
import { ContactChannels } from "@/components/contact/contact-channels";
import { TrackSearch } from "@/components/tracking/track-search";
import { PackingIllustration, RouteIllustration } from "@/components/brand/illustrations";
import { PHOTOS, Photo } from "@/components/brand/photos";

const HIGHLIGHTS: { key: "quote" | "track" | "language" | "account"; icon: LucideIcon }[] = [
  { key: "quote", icon: ClipboardCheck },
  { key: "track", icon: PackageSearch },
  { key: "language", icon: Languages },
  { key: "account", icon: UserRoundCheck },
];

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");
  const media = useTranslations("media");
  const steps = [1, 2, 3, 4] as const;

  return (
    <>
      {/* Hero: real photo from the yard behind an ink overlay. */}
      <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
        <Photo
          src={PHOTOS.yardLoading.src}
          alt="" // decorative here; the same photo is described in the photo section below
          sizes="100vw"
          priority
          className="absolute inset-0 -z-10 rounded-none bg-ink"
          imageClassName="h-full object-[70%_center] opacity-60"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/80 to-ink/10" aria-hidden />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-[3fr_2fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/15 px-3 py-1 text-sm font-medium text-ink-foreground">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
              {t("hero.eyebrow")}
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">{t("hero.title")}</h1>
            <p className="mt-5 max-w-2xl text-lg text-ink-muted">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/quote">
                  {t("hero.quoteCta")}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-ink-foreground/40 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
                <Link href="/how-it-works">{t("hero.secondaryCta")}</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl bg-card p-5 text-card-foreground shadow-xl md:p-6">
            <h2 className="mb-4 text-lg font-semibold">{t("hero.trackCta")}</h2>
            <TrackSearch locale={locale} />
          </div>
        </div>
      </section>

      {/* Highlights: only facts the application itself enforces. */}
      <section aria-labelledby="highlights" className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <h2 id="highlights" className="sr-only">
            {t("highlights.heading")}
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{t(`highlights.${key}Title`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`highlights.${key}Body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("services.heading")}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("services.intro")}</p>
        <ServiceGrid className="mt-8" />
      </section>

      <section className="bg-secondary/60">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("process.heading")}</h2>
            <Link href="/how-it-works" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {t("processMore")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {steps.map((n) => (
              <li key={n} className="relative rounded-2xl border bg-background p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-hidden>
                  {n}
                </span>
                <h3 className="mt-4 font-semibold">{t(`process.step${n}Title`)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t(`process.step${n}Body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Real photographs of the operation. */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("photos.heading")}</h2>
          <p className="mt-3 text-muted-foreground">{t("photos.body")}</p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-[2fr_1fr]">
          <Photo
            src={PHOTOS.yardLoading.src}
            alt={media(PHOTOS.yardLoading.altKey)}
            caption={media(PHOTOS.yardLoading.captionKey)}
            sizes="(min-width: 768px) 66vw, 100vw"
            className="border"
            imageClassName="aspect-[4/3]"
          />
          <Photo
            src={PHOTOS.sideLoader.src}
            alt={media(PHOTOS.sideLoader.altKey)}
            caption={media(PHOTOS.sideLoader.captionKey)}
            sizes="(min-width: 768px) 33vw, 100vw"
            className="self-start border"
            imageClassName="aspect-square"
          />
        </div>
      </section>

      <section className="border-y bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-20">
          <RouteIllustration label={media("routeLabel")} from={media("ireland")} to={media("cameroon")} />
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("route.heading")}</h2>
            <p className="mt-3 text-muted-foreground">{t("route.body")}</p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/contact">{t("route.cta")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-20">
        <div className="md:order-2">
          <PackingIllustration label={media("packingLabel")} />
        </div>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t("guide.heading")}</h2>
          <p className="mt-3 text-muted-foreground">{t("guide.body")}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/shipping-guide">{t("guide.cta")}</Link>
          </Button>
        </div>
      </section>

      <section className="bg-secondary/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-20">
          <FaqPreview />
          <ContactSummary />
        </div>
      </section>

      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">{t("final.heading")}</h2>
            <p className="mt-2 text-ink-muted">{t("final.body")}</p>
          </div>
          <Button asChild size="lg">
            <Link href="/quote">
              {t("hero.quoteCta")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function FaqPreview() {
  const t = useTranslations("faq");
  const home = useTranslations("home.faq");
  return (
    <div>
      <h2 className="text-3xl font-semibold tracking-tight">{home("heading")}</h2>
      <div className="mt-6 divide-y rounded-2xl border bg-background">
        {([1, 3, 4] as const).map((n) => (
          <details key={n} className="group p-5">
            <summary className="cursor-pointer list-none font-medium marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-4">
                {t(`q${n}`)}
                <span className="text-primary transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{t(`a${n}`)}</p>
          </details>
        ))}
      </div>
      <Link href="/faq" className="mt-4 inline-flex items-center gap-1 font-medium text-primary hover:underline">
        {home("more")}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
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
