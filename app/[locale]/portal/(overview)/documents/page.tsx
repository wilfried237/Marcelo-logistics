import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { FileText } from "lucide-react";
import { documentUploadsAvailable } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { pageUser } from "@/lib/auth/page-user";
import { listDocuments } from "@/lib/services/documents";
import { listCustomerQuoteRequests } from "@/lib/services/quote-requests";
import { listCustomerShipments } from "@/lib/services/shipments";
import { Alert } from "@/components/app/alert";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { UploadDocumentForm } from "./upload-form";

export default async function PortalDocuments({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageUser(locale, "/portal/documents");
  const t = await getTranslations("portal.documents");
  const format = await getFormatter();
  const db = getDb();
  const uploads = documentUploadsAvailable();
  const [docs, requests, shipments] = await Promise.all([
    listDocuments(db, user),
    uploads ? listCustomerQuoteRequests(db, user) : Promise.resolve([]),
    uploads ? listCustomerShipments(db, user) : Promise.resolve([]),
  ]);
  const owners = [
    ...requests.map((r) => ({ value: `quote_request:${r.id}`, label: r.reference })),
    ...shipments.map((s) => ({ value: `shipment:${s.id}`, label: s.reference })),
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("intro")} />
      {docs.length ? (
        <ul className="divide-y rounded-lg border bg-card">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{doc.originalName}</p>
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(doc.createdAt), { dateStyle: "medium" })} · {Math.ceil(doc.sizeBytes / 1024)} KB
                </p>
              </div>
              <a href={`/api/documents/${doc.id}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                {t("download")}
                <span className="sr-only">: {doc.originalName}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FileText} title={t("empty")} />
      )}
      <section aria-labelledby="upload" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="upload" className="text-xl font-semibold">
          {t("upload")}
        </h2>
        {uploads && owners.length ? <UploadDocumentForm locale={locale} owners={owners} /> : <Alert className="mt-4">{t("unavailable")}</Alert>}
      </section>
    </div>
  );
}
