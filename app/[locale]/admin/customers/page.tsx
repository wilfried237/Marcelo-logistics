import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Users } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { listCustomersForStaff } from "@/lib/services/users";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export default async function AdminCustomers({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/customers");
  const t = await getTranslations("admin");
  const format = await getFormatter();
  const customers = await listCustomersForStaff(getDb(), user);
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.customers")} />
      {customers.length ? (
        <ul className="divide-y rounded-lg border bg-card">
          {customers.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="font-medium">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {c.hasAccount ? t("quote.hasAccount") : t("quote.noAccount")} · {format.dateTime(new Date(c.createdAt), { dateStyle: "medium" })}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Users} title={t("noCustomers")} />
      )}
    </div>
  );
}
