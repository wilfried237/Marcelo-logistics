"use client";

import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/app/action-form";
import { FormField, selectClassName } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import { DocumentFileInput } from "@/components/app/document-file-input";
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
          <DocumentFileInput />
          <SubmitButton pendingLabel={t("uploading")}>{t("upload")}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
