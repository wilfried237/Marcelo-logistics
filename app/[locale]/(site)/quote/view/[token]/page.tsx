import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/lib/db/client";
import { isDatabaseConfigured } from "@/lib/config/env";
import { getQuoteForLink } from "@/lib/services/cases";
import { PageBanner } from "@/components/app/page-banner";
import { Alert } from "@/components/app/alert";
import { QuoteStatusBadge } from "@/components/app/status-badge";
import { QuoteBreakdown } from "@/components/app/quote-breakdown";
import { MessageForm, RespondForm } from "@/components/quote/case-forms";
import { Link } from "@/i18n/navigation";
import { replyLinkAction, respondLinkAction } from "../actions";

// Signed links are personal: never indexed, never cached.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

/**
 * Quotation page for customers without an account, reached through the signed
 * link in their emails. Shows only customer-visible data; an invalid or forged
 * link renders the standard not-found page (no hint whether a request exists).
 */
export default async function QuoteLinkPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  if (!isDatabaseConfigured()) notFound();
  const view = await getQuoteForLink(getDb(), token);
  if (!view) notFound();
  const t = await getTranslations("quoteView");
  const ts = await getTranslations("services");
  const format = await getFormatter();
  const country = (code: string) => new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  const quoteValid = view.quote?.isValid ?? false;
  const canRespond = view.status === "QUOTED" && view.quote !== null && quoteValid;
  const canReply = !["CANCELLED", "DECLINED"].includes(view.status);

  return (
    <>
      <PageBanner title={t("title", { reference: view.reference })} description={t("intro", { name: view.customerName })} />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-10">
          <section aria-labelledby="status-heading" className="space-y-3">
            <h2 id="status-heading" className="text-2xl font-bold tracking-tight">
              {t("status")}
            </h2>
            <QuoteStatusBadge status={view.status} />
            <p className="text-muted-foreground">{t(`statusHelp.${view.status}` as "statusHelp.SUBMITTED")}</p>
          </section>

          {view.quote && (
            <section aria-labelledby="quote-heading" className="space-y-4">
              <h2 id="quote-heading" className="text-2xl font-bold tracking-tight">
                {t("quoteTitle")}
              </h2>
              <QuoteBreakdown quote={view.quote} locale={locale} />
              {canRespond && <RespondForm action={respondLinkAction} locale={locale} hidden={{ token }} />}
              {view.status === "QUOTED" && !quoteValid && <Alert variant="warning">{t("errors.expired")}</Alert>}
            </section>
          )}

          {view.shipmentReference && (
            <Alert variant="success">
              {t("shipmentReady")}{" "}
              <Link href={`/track/${view.shipmentReference}`} className="font-semibold underline">
                {view.shipmentReference}
              </Link>
            </Alert>
          )}

          <section aria-labelledby="messages-heading" className="space-y-4">
            <h2 id="messages-heading" className="text-2xl font-bold tracking-tight">
              {t("messagesTitle")}
            </h2>
            {view.messages.length ? (
              <ol className="space-y-3">
                {view.messages.map((m, i) => (
                  <li key={i} className={`border-l-4 p-4 ${m.authorKind === "staff" ? "border-brand bg-secondary" : "border-border bg-card"}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {m.authorKind === "staff" ? t("fromTeam") : t("fromYou")} · {format.dateTime(new Date(m.createdAt), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" })}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{m.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground">{t("noMessages")}</p>
            )}
            {canReply && (
              <MessageForm
                action={replyLinkAction}
                locale={locale}
                hidden={{ token }}
                label={view.status === "AWAITING_CUSTOMER" ? t("replyLabelInfo") : t("replyLabel")}
                hint={t("replyHint")}
                submit={t("sendReply")}
              />
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <dl className="divide-y border bg-card text-sm">
            {[
              [t("reference"), view.reference],
              [t("service"), ts(`${view.serviceCode}.title` as "parcels.title")],
              [t("route"), `${country(view.originCountry)} → ${country(view.destinationCountry)}${view.destinationCity ? ` (${view.destinationCity})` : ""}`],
              [t("submitted"), format.dateTime(new Date(view.createdAt), { dateStyle: "medium", timeZone: "Europe/Dublin" })],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">{t("privateLink")}</p>
        </aside>
      </div>
    </>
  );
}
