import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageUser } from "@/lib/auth/page-user";
import { formatMoney } from "@/lib/domain/money";
import { getCustomerQuoteRequest } from "@/lib/services/quote-requests";
import { Alert } from "@/components/app/alert";
import { PageHeader } from "@/components/app/page-header";
import { ItemsList } from "@/components/app/record-lists";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import { RespondToQuote } from "./respond";
import { QuoteBreakdown } from "@/components/app/quote-breakdown";
import { MessageForm } from "@/components/quote/case-forms";
import { replyAction } from "../../actions";

export default async function PortalQuoteDetail({ params }: { params: Promise<{ locale: string; reference: string }> }) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const user = await pageUser(locale, `/portal/quotes/${reference}`);
  // Returns null for other customers' references: same 404 as a missing one.
  const request = await getCustomerQuoteRequest(getDb(), user, reference);
  if (!request) notFound();

  const t = await getTranslations("portal.quoteDetail");
  const ts = await getTranslations("services");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const tv = await getTranslations("quoteView");
  const current = request.quotes[0];
  const stillValid = current && new Date(current.validUntil) > new Date();

  return (
    <div className="space-y-8">
      <PageHeader title={request.reference} description={`${ts(`${request.serviceCode}.title`)} · ${request.originCountry} → ${request.destinationCountry}${request.destinationCity ? ` (${request.destinationCity})` : ""}`} actions={<QuoteStatusBadge status={request.status} />} />

      {request.status === "CANCELLED" && request.cancellationReason && (
        <Alert variant="warning">
          {t("cancelledReason")}: {request.cancellationReason}
        </Alert>
      )}

      <section aria-labelledby="quote" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="quote" className="text-xl font-semibold">
          {t("quoteTitle")}
        </h2>
        {current ? (
          <div className="mt-4 space-y-4">
            <QuoteBreakdown quote={current} locale={locale} />
            {request.status === "QUOTED" && stillValid && (
              <RespondToQuote locale={locale} reference={request.reference} amount={formatMoney(current.amountMinor, current.currency, locale)} />
            )}
            {request.status === "ACCEPTED" && <Alert variant="success">{t("accepted")}</Alert>}
            {request.status === "DECLINED" && <Alert>{t("declined")}</Alert>}
          </div>
        ) : (
          <p className="mt-3 text-muted-foreground">{t("noQuoteYet")}</p>
        )}
        {request.shipmentReference && (
          <p className="mt-4">
            <Link href={`/portal/shipments/${request.shipmentReference}`} className="font-medium text-primary underline-offset-4 hover:underline">
              {t("shipmentLink", { reference: request.shipmentReference })}
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="messages" className="space-y-4">
        <h2 id="messages" className="text-xl font-semibold">
          {tv("messagesTitle")}
        </h2>
        {request.messages.length ? (
          <ol className="space-y-3">
            {request.messages.map((m) => (
              <li key={m.id} className={`border-l-4 p-4 ${m.authorKind === "staff" ? "border-brand bg-secondary" : "border-border bg-card"}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {m.authorKind === "staff" ? tv("fromTeam") : tv("fromYou")} · {format.dateTime(new Date(m.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="mt-1 whitespace-pre-line">{m.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground">{tv("noMessages")}</p>
        )}
        {request.status !== "CANCELLED" && request.status !== "DECLINED" && (
          <MessageForm
            action={replyAction}
            locale={locale}
            hidden={{ reference: request.reference }}
            label={request.status === "AWAITING_CUSTOMER" ? tv("replyLabelInfo") : tv("replyLabel")}
            hint={tv("replyHint")}
            submit={tv("sendReply")}
          />
        )}
      </section>

      <section aria-labelledby="items" className="space-y-3">
        <h2 id="items" className="text-xl font-semibold">
          {t("items")}
        </h2>
        <ItemsList items={request.items} />
        {request.notes && (
          <div>
            <h3 className="mt-4 text-sm font-semibold">{t("notes")}</h3>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{request.notes}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {tc("created")}: {format.dateTime(new Date(request.createdAt), { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </section>
    </div>
  );
}
