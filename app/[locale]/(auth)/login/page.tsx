import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { isEnabled } from "@/lib/config/flags";
import { getCurrentUser, isAccountSystemAvailable } from "@/lib/auth/session";
import { loginUrlError } from "@/lib/auth/redirects";
import { AccountsUnavailable, AuthCard } from "@/components/app/auth-card";
import { Alert } from "@/components/app/alert";
import { LoginForm } from "../auth-forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "auth" }))("loginTitle") };
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string; error?: string; signedOut?: string }> }) {
  const { locale } = await params;
  const { next, error: rawError, signedOut } = await searchParams;
  const error = loginUrlError(rawError);
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  if (!isAccountSystemAvailable()) {
    return (
      <AuthCard title={t("loginTitle")}>
        <AccountsUnavailable />
      </AuthCard>
    );
  }
  const user = await getCurrentUser();
  if (user) redirect({ href: user.role === "customer" ? "/portal" : "/admin", locale });

  return (
    <AuthCard title={t("loginTitle")}>
      {error && (
        <Alert variant="danger" className="mb-5">
          {t(`errors.${error}`)}{" "}
          <Link href="/forgot-password" className="font-medium underline">
            {t("forgotLink")}
          </Link>
        </Alert>
      )}
      {signedOut === "all" && (
        <Alert variant="success" className="mb-5">
          {t("signedOutEverywhere")}
        </Alert>
      )}
      <LoginForm next={typeof next === "string" ? next : undefined} />
      {isEnabled("ENABLE_CUSTOMER_REGISTRATION") && (
        <p className="mt-6 border-t pt-6 text-center text-sm">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("createAccount")}
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
