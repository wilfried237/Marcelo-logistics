import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isAccountSystemAvailable, requireRole } from "@/lib/auth/session";
import { AccountsUnavailable } from "@/components/app/auth-card";
import { AreaShell } from "@/components/app/area-shell";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Staff area. Non-staff users get a 404 (no hint the area exists). Pages and
 * server actions re-check the role; the database enforces it again via RLS.
 */
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isAccountSystemAvailable()) {
    return (
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
        <AccountsUnavailable />
      </main>
    );
  }
  const user = await requireRole(["staff", "admin"], locale, `/${locale}/admin`);
  const t = await getTranslations("admin");
  const t2 = await getTranslations("nav2");
  const items = [
    { href: "/admin", label: t("nav.dashboard") },
    { href: "/admin/quotes", label: t("nav.quotes") },
    { href: "/admin/shipments", label: t("nav.shipments") },
    { href: "/admin/customers", label: t("nav.customers") },
    { href: "/admin/audit", label: t("nav.audit") },
    ...(user.role === "admin" ? [{ href: "/admin/users", label: t("nav.users") }] : []),
  ];
  return (
    <AreaShell locale={locale} title={t("title")} navLabel={t2("adminNav")} items={items} userLabel={user.email}>
      {children}
    </AreaShell>
  );
}
