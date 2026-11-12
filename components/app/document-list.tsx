import { getFormatter, getTranslations } from "next-intl/server";
import type { RecordDocument } from "@/lib/services/documents";

const TYPE_LABEL: Record<string, string> = { "application/pdf": "PDF", "image/jpeg": "JPEG", "image/png": "PNG" };

/**
 * Documents of one quote request or shipment. Files are only ever reached
 * through /api/documents/[id], which re-checks access and hands out a
 * 60-second signed URL; nothing here links to storage directly.
 */
export async function DocumentList({ documents, audience }: { documents: RecordDocument[]; audience: "customer" | "staff" }) {
  const t = await getTranslations("documents");
  const format = await getFormatter();
  if (!documents.length) return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {documents.map((doc) => (
        <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{doc.originalName}</p>
            <p className="text-xs text-muted-foreground">
              {TYPE_LABEL[doc.mime] ?? doc.mime} · {t("size", { kb: Math.max(1, Math.ceil(doc.sizeBytes / 1024)) })} ·{" "}
              {format.dateTime(new Date(doc.createdAt), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" })}
              {audience === "customer" && <> · {doc.addedByYou ? t("addedByYou") : t("addedByUs")}</>}
              {audience === "staff" && doc.uploader && (
                <> · {doc.uploader.kind === "customer" ? t("uploadedByCustomer") : doc.uploader.name ? t("uploadedByStaffName", { name: doc.uploader.name }) : t("uploadedByStaff")}</>
              )}
            </p>
          </div>
          <a href={`/api/documents/${doc.id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("download")}
            <span className="sr-only">: {doc.originalName}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
