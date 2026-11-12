"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/app/alert";
import { DocumentFileInput } from "@/components/app/document-file-input";
import { FormField, selectClassName } from "@/components/app/form-field";
import { Button } from "@/components/ui/button";
import { MAX_DOCUMENT_MEGABYTES } from "@/lib/config/upload-limits";

type Owner = { value: string; label: string };
type Status = { kind: "ok" | "error"; message: string } | null;

/** Server answer codes (POST /api/documents) and the message shown for each. */
const ERROR_KEYS: Record<string, string> = {
  TOO_LARGE: "errors.too_large",
  TYPE: "errors.type",
  UNSUPPORTED_MEDIA_TYPE: "errors.type",
  EMPTY: "errors.empty",
  NOT_FOUND: "errors.not_found",
  UPLOADS_DISABLED: "unavailable",
  RATE_LIMITED: "errors.rate_limited",
};

/**
 * Document upload form for customers (choose one of their records) and staff
 * (fixed record). Posts to POST /api/documents, which re-checks everything on
 * the server; the 4 MB check here only saves a pointless upload.
 */
export function DocumentUploadForm({ owners, owner, className = "mt-4 space-y-4" }: { owners?: Owner[]; owner?: { type: "quote_request" | "shipment"; id: string }; className?: string }) {
  const t = useTranslations("portal.documents");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setStatus({ kind: "error", message: t("errors.empty") });
      return;
    }
    const [ownerType, ownerId] = owner ? [owner.type, owner.id] : String(data.get("owner") ?? "").split(":");
    const body = new FormData();
    body.set("ownerType", ownerType ?? "");
    body.set("ownerId", ownerId ?? "");
    body.set("file", file, file.name);
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/api/documents", { method: "POST", body, credentials: "same-origin" });
      const result = (await response.json().catch(() => ({}))) as { code?: string };
      if (response.ok) {
        setStatus({ kind: "ok", message: t("uploaded") });
        formRef.current?.reset();
        router.refresh();
      } else {
        const key = ERROR_KEYS[result.code ?? ""] ?? "errors.generic";
        setStatus({ kind: "error", message: t(key as "errors.generic", { max: MAX_DOCUMENT_MEGABYTES }) });
      }
    } catch {
      setStatus({ kind: "error", message: t("errors.generic") });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className} noValidate>
      {status && <Alert variant={status.kind === "ok" ? "success" : "danger"}>{status.message}</Alert>}
      {owners && (
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
      )}
      <DocumentFileInput id={owner ? `file-${owner.type}` : "file"} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t("uploading") : t("upload")}
      </Button>
    </form>
  );
}
