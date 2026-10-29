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
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">{t("amount")}</dt>
                <dd className="text-2xl font-bold">{formatMoney(current.amountMinor, current.currency, locale)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t("validUntil")}</dt>
                <dd className="font-medium">{format.dateTime(new Date(current.validUntil), { dateStyle: "long" })}</dd>
              </div>
              {current.inclusions && (
                <div>
                  <dt className="text-sm text-muted-foreground">{t("inclusions")}</dt>
                  <dd className="whitespace-pre-line">{current.inclusions}</dd>
                </div>
              )}
              {current.exclusions && (
                <div>
                  <dt className="text-sm text-muted-foreground">{t("exclusions")}</dt>
                  <dd className="whitespace-pre-line">{current.exclusions}</dd>
                </div>
              )}
            </dl>
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
