import { getTranslations, setRequestLocale } from "next-intl/server";
import { isStorageConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { listUsersForAdmin } from "@/lib/services/users";
import { InviteForm, RoleForm } from "@/components/admin/admin-forms";
import { Alert } from "@/components/app/alert";
import { PageHeader } from "@/components/app/page-header";

/** Administrators only: staff get a 404 from pageStaff(["admin"]). */
export default async function AdminUsers({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/users", ["admin"]);
  const t = await getTranslations("admin.users");
  const users = await listUsersForAdmin(getDb(), user);
  return (
    <div className="space-y-8">
      <PageHeader title={(await getTranslations("admin"))("nav.users")} description={t("intro")} />
      <section aria-labelledby="invite" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="invite" className="mb-4 text-lg font-semibold">
          {t("invite")}
        </h2>
        {isStorageConfigured() ? <InviteForm locale={locale} /> : <Alert>{t("inviteUnavailable")}</Alert>}
      </section>
      <ul className="divide-y rounded-lg border bg-card">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-medium">{u.name ?? u.email ?? u.id}</p>
              <p className="truncate text-sm text-muted-foreground">
                {u.email ?? "—"} · {t(`roles.${u.role}`)}
              </p>
            </div>
            <RoleForm locale={locale} userId={u.id} role={u.role} label={u.name ?? u.email ?? u.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
