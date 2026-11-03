import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  const t = useTranslations("notFoundPage");
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="max-w-md text-center">
        <Logo className="mx-auto mb-8 h-16 w-auto" />
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("body")}</p>
        <Button asChild className="mt-6">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </main>
  );
}
