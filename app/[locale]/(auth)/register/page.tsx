import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Honest placeholder until Supabase Auth is configured (see docs/IMPLEMENTATION-STATUS.md). */
export default function Page() {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">{t("registerTitle")}</h1>
      <div role="status" className="mt-6 rounded-lg border bg-secondary/40 p-5">
        <p className="font-semibold">{t("unavailableTitle")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("unavailableBody")}</p>
      </div>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}
