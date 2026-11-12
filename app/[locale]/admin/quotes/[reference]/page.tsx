import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { formatMoney } from "@/lib/domain/money";
import { getQuoteRequestForStaff } from "@/lib/services/quote-requests";
import { CreateShipmentForm, QuoteCalculatorForm, NoteForm, RequestInfoForm, AssignForm, TransitionForm } from "@/components/admin/admin-forms";
import { DocumentUploadForm } from "@/components/app/document-upload-form";
import { documentUploadsAvailable } from "@/lib/config/env";
import { Alert } from "@/components/app/alert";
import { PageHeader } from "@/components/app/page-header";
import { ItemsList } from "@/components/app/record-lists";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import { suggestedValidUntil } from "@/lib/domain/time";
import { ownerConfig } from "@/config/owner";
import { formatMinor } from "@/lib/domain/pricing";
import { listAssignableStaff, listEmailsForRequest } from "@/lib/services/cases";
import { listRecordDocumentsForStaff } from "@/lib/services/documents";
import { DocumentList } from "@/components/app/document-list";

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
  const defaultValidUntil = suggestedValidUntil();
  const canQuote = request.status === "UNDER_REVIEW" || request.status === "AWAITING_CUSTOMER";
  const tcase = await getTranslations("admin.case");
  const tcalc = await getTranslations("admin.calc");
  const staff = await listAssignableStaff(getDb(), user);
  const emails = await listEmailsForRequest(getDb(), user, request.id);
  const tdoc = await getTranslations("documents");
  const tpd = await getTranslations("portal.documents");
  const documents = await listRecordDocumentsForStaff(getDb(), user, "quote_request", request.id);

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
            <ItemsList items={request.items} showCurrentGuidePrice />
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
                    {q.lines.length > 0 && (
                      <table className="mt-2 w-full text-xs">
                        <tbody>
                          {q.lines.map((l) => (
                            <tr key={l.position} className="border-t">
                              <td className="py-1 pr-2">{l.description}</td>
                              <td className="py-1 pr-2 text-right tabular-nums">{l.kind === "tax" ? `${(l.rateBp ?? 0) / 100} %` : `${l.quantity} × ${formatMinor(l.unitAmountMinor, q.currency, locale)}`}</td>
                              <td className="py-1 text-right tabular-nums">{formatMinor(l.lineTotalMinor, q.currency, locale)}</td>
                            </tr>
                          ))}
                          <tr className="border-t font-semibold">
                            <td className="py-1" colSpan={2}>
                              {tcalc("total")}
                            </td>
                            <td className="py-1 text-right tabular-nums">{formatMinor(q.amountMinor, q.currency, locale)}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
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
                <QuoteCalculatorForm locale={locale} requestId={request.id} defaultValidUntil={defaultValidUntil} taxRatesBp={[...ownerConfig.pricing.taxRatesBp]} />
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

          <Section id="communication" title={tcase("communication")}>
            {request.messages.length ? (
              <ol className="space-y-3">
                {request.messages.map((m) => (
                  <li key={m.id} className={`border-l-4 p-3 text-sm ${m.internal ? "border-warning bg-warning-soft" : m.authorKind === "customer" ? "border-brand bg-secondary" : "border-primary bg-background"}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {tcase(`kinds.${m.kind}` as "kinds.note")} · {format.dateTime(new Date(m.createdAt), { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{m.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{tcase("noMessages")}</p>
            )}
            <div className="mt-6 grid gap-6 border-t pt-6 lg:grid-cols-2">
              <NoteForm locale={locale} requestId={request.id} />
              {request.status === "UNDER_REVIEW" && <RequestInfoForm locale={locale} requestId={request.id} />}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section id="assignment" title={tcase("assignment")}>
            <AssignForm locale={locale} requestId={request.id} assignedTo={request.assignedTo} staff={staff.map((s) => ({ id: s.id, email: s.email }))} />
          </Section>
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
          <Section id="documents" title={tdoc("title")}>
            <DocumentList documents={documents} audience="staff" />
            {documentUploadsAvailable() ? (
              <DocumentUploadForm owner={{ type: "quote_request", id: request.id }} className="mt-4 space-y-3" />
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">{tpd("unavailable")}</p>
            )}
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
            <p className="mt-3 text-xs text-muted-foreground">
              {request.privacyAcceptedAt ? tcase("privacyAccepted", { date: format.dateTime(new Date(request.privacyAcceptedAt), { dateStyle: "short", timeStyle: "short" }) }) : tcase("privacyNotRecorded")}
            </p>
          </Section>
          <Section id="emails" title={tcase("emails")}>
            {emails.length ? (
              <ul className="space-y-2 text-sm">
                {emails.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b pb-2">
                    <span>
                      {e.template} <span className="text-muted-foreground">({e.audience})</span>
                    </span>
                    <span className={e.status === "DEAD" || e.status === "BOUNCED" || e.status === "FAILED" ? "font-semibold text-destructive" : "text-muted-foreground"}>
                      {e.status}
                      {e.attempts > 1 ? ` · ${e.attempts}×` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{tcase("noEmails")}</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
