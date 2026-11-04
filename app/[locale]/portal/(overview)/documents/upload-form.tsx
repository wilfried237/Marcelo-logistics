"use client";

import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/app/action-form";
import { FormField, selectClassName } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import { uploadDocumentAction } from "../../actions";

export function UploadDocumentForm({ locale, owners }: { locale: string; owners: { value: string; label: string }[] }) {
  const t = useTranslations("portal.documents");
  return (
    <ActionForm action={uploadDocumentAction} className="mt-4 space-y-4">
      {() => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <FormField id="owner" label={t("uploadFor")}>
            {(p) => (
              <select {...p} name="owner" className={selectClassName} required>
                {owners.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField id="file" label={t("file")}>
            {(p) => <input {...p} type="file" name="file" accept="application/pdf,image/jpeg,image/png" required className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-2" />}
          </FormField>
          <SubmitButton pendingLabel={t("uploading")}>{t("upload")}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
