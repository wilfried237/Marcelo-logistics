import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/app/page-banner";
import { PHOTOS, Photo } from "@/components/brand/photos";
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
  const normalMilestones = MILESTONE_CODES.filter((code) => !EXCEPTION_MILESTONES.includes(code));

  return (
    <>
      <PageBanner title={t("title")} description={t("intro")} />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 md:px-6 lg:grid-cols-[2fr_1fr]">
        <ol className="space-y-10">
          <Step title={t("step1Title")} body={t("step1Body")}>
            <ul className="mt-4 space-y-2">
              {([1, 2, 3, 4] as const).map((n) => (
                <li key={n} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {t(`step1Point${n}`)}
                </li>
              ))}
            </ul>
          </Step>
          <Step title={t("step2Title")} body={t("step2Body")} />
          <Step title={t("step3Title")} body={t("step3Body")} />
          <Step title={t("step4Title")} body={t("step4Body")} />
          <Step title={t("step5Title")} body={t("step5Body")}>
            <ol className="mt-5 grid gap-2 sm:grid-cols-2">
              {normalMilestones.map((code, i) => (
                <li key={code} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground" aria-hidden>
                    {i + 1}
                  </span>
                  {milestones(code)}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-muted-foreground">{t("step5Exceptions")}</p>
          </Step>
          <Step title={t("step6Title")} body={t("step6Body")} />
        </ol>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Photo src={PHOTOS.yardLoading.src} alt={media(PHOTOS.yardLoading.altKey)} caption={media(PHOTOS.yardLoading.captionKey)} sizes="(min-width: 1024px) 33vw, 100vw" className="border" imageClassName="aspect-[4/3]" />
          <Button asChild size="lg" className="w-full">
            <Link href="/quote">
              {t("cta")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </aside>
      </div>
    </>
  );
}

function Step({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <li className="border-l-2 border-brand pl-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{body}</p>
      {children}
    </li>
  );
}
