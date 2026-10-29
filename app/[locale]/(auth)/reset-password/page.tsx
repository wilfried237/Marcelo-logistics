import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, isAccountSystemAvailable } from "@/lib/auth/session";
import { AccountsUnavailable, AuthCard } from "@/components/app/auth-card";
import { Alert } from "@/components/app/alert";
import { ResetPasswordForm } from "../auth-forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "auth" }))("resetTitle") };
}

/** Reached from the recovery or invitation email; the callback route establishes the session first. */
export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  if (!isAccountSystemAvailable()) {
    return (
      <AuthCard title={t("resetTitle")}>
        <AccountsUnavailable />
      </AuthCard>
    );
  }
  const user = await getCurrentUser();
  return (
    <AuthCard title={t("resetTitle")}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Alert variant="warning">
          {t("errors.session_required")}{" "}
          <Link href="/forgot-password" className="font-medium underline">
            {t("forgotLink")}
          </Link>
        </Alert>
      )}
    </AuthCard>
  );
}
