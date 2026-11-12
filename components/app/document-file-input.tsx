"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/app/form-field";
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_MEGABYTES } from "@/lib/config/upload-limits";

/**
 * File input for document uploads. A file over the 4 MB limit is cleared before
 * the form can send it, so the request never reaches the server's body limit;
 * the server action and the document service still enforce the limit themselves.
 */
export function DocumentFileInput({ id = "file" }: { id?: string }) {
  const t = useTranslations("portal.documents");
  const [tooLarge, setTooLarge] = useState(false);
  return (
    <FormField id={id} label={t("file", { max: MAX_DOCUMENT_MEGABYTES })} error={tooLarge ? t("errors.too_large", { max: MAX_DOCUMENT_MEGABYTES }) : undefined}>
      {(p) => (
        <input
          {...p}
          type="file"
          name="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            const over = !!file && file.size > MAX_DOCUMENT_BYTES;
            setTooLarge(over);
            if (over) e.currentTarget.value = "";
          }}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-2"
        />
      )}
    </FormField>
  );
}
