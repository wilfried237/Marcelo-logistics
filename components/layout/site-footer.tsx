import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandMark } from "@/components/brand/illustrations";
import { BrandName } from "./brand-name";

export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="border-t bg-secondary/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[2fr_1fr_1fr] md:px-6">
        <div className="space-y-2">
          <p className="flex items-center gap-2 font-semibold">
            <BrandMark className="h-7 w-9" />
            <BrandName />
          </p>
          <p className="text-sm text-muted-foreground">{t("footer.pendingDetails")}</p>
        </div>
        <nav aria-label={t("nav.services")} className="flex flex-col gap-2 text-sm">
          <Link href="/services" className="hover:underline">{t("nav.services")}</Link>
          <Link href="/quote" className="hover:underline">{t("nav.quote")}</Link>
          <Link href="/track" className="hover:underline">{t("nav.track")}</Link>
          <Link href="/how-it-works" className="hover:underline">{t("nav2.howItWorks")}</Link>
          <Link href="/shipping-guide" className="hover:underline">{t("nav2.guide")}</Link>
        </nav>
        <nav aria-label={t("nav2.company")} className="flex flex-col gap-2 text-sm">
          <Link href="/about" className="hover:underline">{t("nav2.about")}</Link>
          <Link href="/faq" className="hover:underline">{t("nav2.faq")}</Link>
          <Link href="/contact" className="hover:underline">{t("nav.contact")}</Link>
          <Link href="/privacy" className="hover:underline">{t("nav2.privacy")}</Link>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground md:px-6">
          © {new Date().getFullYear()} <BrandName />. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
