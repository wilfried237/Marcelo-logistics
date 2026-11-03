import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { MessageSquare } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { listContactEnquiries } from "@/lib/services/cases";
import { ContactStatusForm } from "@/components/admin/admin-forms";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export default async function AdminEnquiries({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/enquiries");
  const t = await getTranslations("admin.enquiries");
  const format = await getFormatter();
  const enquiries = await listContactEnquiries(getDb(), user);
  return (
    <div className="space-y-6">
      <PageHeader title={(await getTranslations("admin"))("nav.enquiries")} description={t("intro")} />
      {enquiries.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t("none")} />
      ) : (
        <ul className="space-y-4">
          {enquiries.map((e) => (
            <li key={e.id} className="border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold">{e.reference}</p>
                  <p className="mt-1 font-medium">
                    {e.name} ·{" "}
                    <a href={`mailto:${e.email}`} className="text-primary underline-offset-4 hover:underline">
                      {e.email}
                    </a>
                    {e.phone ? ` · ${e.phone}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`topics.${e.topic}` as "topics.general")} · {e.locale.toUpperCase()} · {format.dateTime(e.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                    {e.relatedReference && (
                      <>
                        {" · "}
                        <Link
                          href={e.relatedReference.startsWith("QR") ? `/admin/quotes/${e.relatedReference}` : `/admin/shipments/${e.relatedReference}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {e.relatedReference}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <ContactStatusForm locale={locale} id={e.id} status={e.status} />
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{e.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
