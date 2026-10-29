import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { isEnabled } from "@/lib/config/flags";
import { isAccountSystemAvailable } from "@/lib/auth/session";
import { AccountsUnavailable, AuthCard } from "@/components/app/auth-card";
import { Alert } from "@/components/app/alert";
import { RegisterForm } from "../auth-forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "auth" }))("registerTitle") };
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  let body: React.ReactNode;
  if (!isAccountSystemAvailable()) body = <AccountsUnavailable />;
  else if (!isEnabled("ENABLE_CUSTOMER_REGISTRATION")) body = <Alert title={t("registrationClosedTitle")}>{t("registrationClosedBody")}</Alert>;
  else body = <RegisterForm />;

  return (
    <AuthCard title={t("registerTitle")}>
      {body}
      <p className="mt-6 border-t pt-6 text-center text-sm">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </AuthCard>
  );
}
