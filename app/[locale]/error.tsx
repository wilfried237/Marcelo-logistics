"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

/** Generic error boundary. Never shows technical details to visitors. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    console.error("page error", error.digest ?? error.name);
  }, [error]);
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md text-center" role="alert">
        <Logo className="mx-auto mb-8 h-16 w-auto" />
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("body")}</p>
        <Button className="mt-6" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
