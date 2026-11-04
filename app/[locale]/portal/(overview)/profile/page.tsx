import { getTranslations, setRequestLocale } from "next-intl/server";
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
    </div>
  );
}
