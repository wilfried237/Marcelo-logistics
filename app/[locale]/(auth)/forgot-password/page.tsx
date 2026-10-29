import { getTranslations, setRequestLocale } from "next-intl/server";
import { isAccountSystemAvailable } from "@/lib/auth/session";
import { AccountsUnavailable, AuthCard } from "@/components/app/auth-card";
import { ForgotPasswordForm } from "../auth-forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "auth" }))("forgotTitle") };
}

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("forgotTitle")} description={isAccountSystemAvailable() ? t("forgotBody") : undefined}>
      {isAccountSystemAvailable() ? <ForgotPasswordForm /> : <AccountsUnavailable />}
    </AuthCard>
  );
}
