import { useTranslations } from "next-intl";
import { Alert } from "./alert";

export function AuthCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** Shown while Supabase Auth or the database is not configured. */
export function AccountsUnavailable() {
  const t = useTranslations("auth");
  return <Alert title={t("unavailableTitle")}>{t("unavailableBody")}</Alert>;
}
