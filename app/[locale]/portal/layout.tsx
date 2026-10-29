import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isAccountSystemAvailable, requireUser } from "@/lib/auth/session";
import { AccountsUnavailable } from "@/components/app/auth-card";
import { AreaShell } from "@/components/app/area-shell";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Customer area. Every page below re-checks ownership in its queries (RLS + explicit filters). */
export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isAccountSystemAvailable()) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
          <AccountsUnavailable />
        </main>
        <SiteFooter />
      </>
    );
  }
  const user = await requireUser(locale, `/${locale}/portal`);
  const t = await getTranslations("portal");
  const t2 = await getTranslations("nav2");
  const items = [
    { href: "/portal", label: t("nav.overview") },
    { href: "/portal/quotes", label: t("nav.quotes") },
    { href: "/portal/shipments", label: t("nav.shipments") },
    { href: "/portal/documents", label: t("nav.documents") },
    { href: "/portal/profile", label: t("nav.profile") },
  ];
  return (
    <AreaShell locale={locale} title={t("title")} navLabel={t2("portalNav")} items={items} userLabel={user.email}>
      {children}
    </AreaShell>
  );
}
