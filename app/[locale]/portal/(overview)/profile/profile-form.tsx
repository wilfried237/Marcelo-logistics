"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/app/action-form";
import { FormField, inputClassName, selectClassName } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import { updateProfileAction } from "../../actions";

export function ProfileForm({ locale, profile }: { locale: string; profile: { name: string; email: string; phone: string | null; preferredLocale: "en" | "fr" } }) {
  const t = useTranslations("portal.profile");
  const tc = useTranslations("common");
  return (
    <ActionForm action={updateProfileAction} className="space-y-5">
      {(state) => {
        const fe = state.status === "error" ? state.fieldErrors : undefined;
        return (
          <>
            <input type="hidden" name="locale" value={locale} />
            <FormField id="name" label={t("name")} error={fe?.name}>
              {(p) => <Input {...p} name="name" defaultValue={profile.name} autoComplete="name" maxLength={120} required className={inputClassName} />}
            </FormField>
            <FormField id="email" label={t("email")} hint={t("emailHint")}>
              {(p) => <Input {...p} value={profile.email} readOnly disabled className={inputClassName} />}
            </FormField>
            <FormField id="phone" label={t("phone")} optionalLabel={tc("optional")} error={fe?.phone}>
              {(p) => <Input {...p} name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" maxLength={32} className={inputClassName} />}
            </FormField>
            <FormField id="preferredLocale" label={t("language")}>
              {(p) => (
                <select {...p} name="preferredLocale" defaultValue={profile.preferredLocale} className={selectClassName}>
                  <option value="en">{t("english")}</option>
                  <option value="fr">{t("french")}</option>
                </select>
              )}
            </FormField>
            <SubmitButton pendingLabel={tc("saving")}>{tc("save")}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}
