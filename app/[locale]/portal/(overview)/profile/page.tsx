import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/app/[locale]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/client";
import { pageUser } from "@/lib/auth/page-user";
import { getOwnCustomerProfile } from "@/lib/services/users";
import { Alert } from "@/components/app/alert";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForm } from "./profile-form";

export default async function PortalProfile({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageUser(locale, "/portal/profile");
  const t = await getTranslations("portal.profile");
  const tc = await getTranslations("common");
  const profile = await getOwnCustomerProfile(getDb(), user);
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title={t("title")} />
      {profile ? <ProfileForm locale={locale} profile={profile} /> : <Alert>{tc("unavailableBody")}</Alert>}
      <section aria-labelledby="security-heading" className="space-y-4 border-t pt-6">
        <h2 id="security-heading" className="text-xl font-semibold">
          {t("securityTitle")}
        </h2>
        <div>
          <Link href="/reset-password" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t("changePassword")}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">{t("changePasswordHint")}</p>
        </div>
        {/* Revokes every session of this account (all devices), then returns to the sign-in page. */}
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="scope" value="global" />
          <Button type="submit" variant="outline">
            {t("signOutEverywhere")}
          </Button>
          <p className="mt-1 text-sm text-muted-foreground">{t("signOutEverywhereHint")}</p>
        </form>
      </section>
    </div>
  );
}
