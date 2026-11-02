import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { PHOTOS, Photo } from "@/components/brand/photos";
import { DepartureSchedule } from "@/components/schedule/departure-schedule";
import { EXCEPTION_MILESTONES, MILESTONE_CODES } from "@/lib/domain/enums";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return { title: t("title"), description: t("intro") };
}

/** The real workflow of the application, step by step (no invented timings or locations). */
export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("howItWorks");
  const milestones = await getTranslations("milestones");
  const media = await getTranslations("media");
  const schedule = await getTranslations("schedule");
  const normalMilestones = MILESTONE_CODES.filter((code) => !EXCEPTION_MILESTONES.includes(code));

  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 md:px-6 md:py-16 lg:grid-cols-[2fr_1fr]">
        <ol className="divide-y border-y">
          <Step title={t("step1Title")} body={t("step1Body")}>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 marker:text-brand">
              {([1, 2, 3, 4] as const).map((n) => (
                <li key={n}>{t(`step1Point${n}`)}</li>
              ))}
            </ul>
          </Step>
          <Step title={t("step2Title")} body={t("step2Body")} />
          <Step title={t("step3Title")} body={t("step3Body")} />
          <Step title={t("step4Title")} body={t("step4Body")}>
            <h3 className="mt-5 font-semibold">{schedule("heading")}</h3>
            <DepartureSchedule className="mt-3" />
            <p className="mt-3 text-sm text-muted-foreground">{schedule("askExact")}</p>
          </Step>
          <Step title={t("step5Title")} body={t("step5Body")}>
            <ol className="mt-5 grid gap-px border bg-border sm:grid-cols-2">
              {normalMilestones.map((code, i) => (
                <li key={code} className="flex items-baseline gap-3 bg-background px-4 py-3">
                  <span className="w-5 shrink-0 text-right font-bold text-primary">{i + 1}</span>
                  {milestones(code)}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-muted-foreground">{t("step5Exceptions")}</p>
          </Step>
          <Step title={t("step6Title")} body={t("step6Body")} />
        </ol>

        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <Photo src={PHOTOS.yardLoading.src} alt={media(PHOTOS.yardLoading.altKey)} caption={media(PHOTOS.yardLoading.captionKey)} sizes="(min-width: 1024px) 33vw, 100vw" className="rounded-none border" imageClassName="aspect-[4/3]" />
          <Button asChild size="lg" className="w-full">
            <Link href="/quote">{t("cta")}</Link>
          </Button>
        </aside>
      </div>
    </>
  );
}

function Step({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <li className="py-8">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-muted-foreground">{body}</p>
      {children}
    </li>
  );
}
