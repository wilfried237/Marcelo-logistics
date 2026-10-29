import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { formatMoney } from "@/lib/domain/money";
import { getQuoteRequestForStaff } from "@/lib/services/quote-requests";
import { CreateShipmentForm, SendQuoteForm, TransitionForm } from "@/components/admin/admin-forms";
import { Alert } from "@/components/app/alert";
import { PageHeader } from "@/components/app/page-header";
import { ItemsList } from "@/components/app/record-lists";
import { QuoteStatusBadge } from "@/components/app/status-badge";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card p-5 md:p-6">
      <h2 id={id} className="mb-4 text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function AdminQuoteDetail({ params }: { params: Promise<{ locale: string; reference: string }> }) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, `/admin/quotes/${reference}`);
  const request = await getQuoteRequestForStaff(getDb(), user, reference);
  if (!request) notFound();
  const t = await getTranslations("admin.quote");
  const tp = await getTranslations("portal.quoteDetail");
  const ts = await getTranslations("services");
  const tq = await getTranslations("status.quote");
  const format = await getFormatter();
  const defaultValidUntil = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const canQuote = request.status === "UNDER_REVIEW" || request.status === "AWAITING_CUSTOMER";

  return (
    <div className="space-y-6">
      <PageHeader
        title={request.reference}
        description={`${ts(`${request.serviceCode}.title`)} · ${request.originCountry} → ${request.destinationCountry}${request.destinationCity ? ` (${request.destinationCity})` : ""}`}
        actions={<QuoteStatusBadge status={request.status} />}
      />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Section id="request" title={t("requestDetails")}>
            <ItemsList items={request.items} />
            {request.notes && <p className="mt-4 whitespace-pre-line text-sm">{request.notes}</p>}
            {request.cancellationReason && (
              <Alert variant="warning" className="mt-4">
                {tp("cancelledReason")}: {request.cancellationReason}
              </Alert>
            )}
          </Section>

          <Section id="quotes" title={t("previousQuotes")}>
            {request.quotes.length ? (
              <ul className="space-y-3">
                {request.quotes.map((q) => (
                  <li key={q.id} className="rounded-md border p-3 text-sm">
                    <p className="font-semibold">
                      {formatMoney(q.amountMinor, q.currency, locale)} · {tp("validUntil")} {format.dateTime(new Date(q.validUntil), { dateStyle: "medium" })}
                      {!q.sentAt && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">{t("draft")}</span>}
                    </p>
                    {q.inclusions && <p className="mt-1 text-muted-foreground">+ {q.inclusions}</p>}
                    {q.exclusions && <p className="text-muted-foreground">− {q.exclusions}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{tp("noQuoteYet")}</p>
            )}
            {canQuote && (
              <div className="mt-6 border-t pt-6">
                <h3 className="mb-3 font-semibold">{t("sendQuoteTitle")}</h3>
                <SendQuoteForm locale={locale} requestId={request.id} defaultValidUntil={defaultValidUntil} />
              </div>
            )}
            {request.status === "ACCEPTED" && !request.shipmentReference && (
              <div className="mt-6 border-t pt-6">
                <CreateShipmentForm locale={locale} requestId={request.id} />
              </div>
            )}
            {request.shipmentReference && (
              <p className="mt-4">
                <Link href={`/admin/shipments/${request.shipmentReference}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {request.shipmentReference}
                </Link>
              </p>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section id="customer" title={t("customerDetails")}>
            <dl className="space-y-1 text-sm">
              <dt className="sr-only">Name</dt>
              <dd className="font-medium">{request.customerName}</dd>
              <dt className="sr-only">Email</dt>
              <dd>
                <a href={`mailto:${request.customerEmail}`} className="underline-offset-4 hover:underline">
                  {request.customerEmail}
                </a>
              </dd>
              {request.customerPhone && (
                <>
                  <dt className="sr-only">Phone</dt>
                  <dd>{request.customerPhone}</dd>
                </>
              )}
              <dd className="text-muted-foreground">
                {request.customerHasAccount ? t("hasAccount") : t("noAccount")} · {request.customerLocale.toUpperCase()}
              </dd>
            </dl>
          </Section>
          <Section id="workflow" title={t("workflow")}>
            <TransitionForm locale={locale} requestId={request.id} status={request.status} />
          </Section>
          <Section id="history" title={t("history")}>
            <ol className="space-y-2 text-sm">
              {request.history.map((h, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">{format.dateTime(new Date(h.at), { dateStyle: "short", timeStyle: "short" })}</span>{" "}
                  {h.action === "quote_requests.status_changed" && h.after && typeof h.after === "object" && "status" in h.after
                    ? tq((h.after as { status: "SUBMITTED" }).status)
                    : h.action}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
