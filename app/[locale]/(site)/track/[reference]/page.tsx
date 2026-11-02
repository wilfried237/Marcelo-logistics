import type { Metadata } from "next";
import { headers } from "next/headers";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { isDatabaseConfigured } from "@/lib/config/env";
import { isDemoDataEnabled } from "@/lib/config/flags";
import { getDb } from "@/lib/db/client";
import { DEMO_SHIPMENTS } from "@/lib/demo/tracking";
import { trackShipment, type PublicTracking, type TrackResult } from "@/lib/services/tracking";
import type { MilestoneCode } from "@/lib/domain/enums";
import { Alert } from "@/components/app/alert";
import { Container } from "@/components/app/page-header";
import { PageBanner } from "@/components/app/page-banner";
import { MilestoneTimeline } from "@/components/app/milestone-timeline";
import { ShipmentStatusBadge } from "@/components/app/status-badge";
import { ContactChannels } from "@/components/contact/contact-channels";
import { TrackSearch } from "@/components/tracking/track-search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function lookup(reference: string): Promise<TrackResult | { ok: false; code: "unavailable" }> {
  if (isDatabaseConfigured()) {
    const h = await headers();
    const clientId = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown-client";
    return trackShipment(getDb(), reference, clientId);
  }
  // Development only: clearly fictitious demo data.
  const demo = isDemoDataEnabled() ? DEMO_SHIPMENTS[reference.toUpperCase()] : undefined;
  if (demo) {
    const shipment: PublicTracking = {
      reference: demo.reference,
      serviceCode: "barrels",
      status: "IN_TRANSIT",
      etaFrom: null,
      etaTo: null,
      events: [...demo.events].reverse().map((e) => ({ milestone: e.milestone as MilestoneCode, location: e.location, occurredAt: e.occurredAt, noteEn: null, noteFr: null })),
    };
    return { ok: true, shipment };
  }
  return { ok: false, code: "unavailable" };
}

export default async function TrackResultPage({ params }: { params: Promise<{ locale: string; reference: string }> }) {
  const { locale, reference: raw } = await params;
  setRequestLocale(locale);
  const reference = decodeURIComponent(raw).toUpperCase().slice(0, 20);
  const t = await getTranslations("trackPage");
  const tt = await getTranslations("track");
  const ts = await getTranslations("services");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const result = await lookup(reference);

  const errorMessage = !result.ok
    ? { invalid_reference: t("invalid"), not_found: t("notFound"), rate_limited: t("rateLimited"), unavailable: t("unavailable") }[result.code]
    : undefined;

  return (
    <>
      <PageBanner title={tt("hero.title")} />
      <Container size="narrow" className="pb-14">

        {result.ok ? (
          <div className="mt-8 space-y-8">
            <section aria-labelledby="summary" className="rounded-xl border bg-card p-5 md:p-8">
              <h2 id="summary" className="sr-only">
                {t("statusLabel")}
              </h2>
              <p className="text-sm text-muted-foreground">{tt("shipment.status.tracking")}</p>
              <p className="font-mono text-xl font-semibold tracking-wider">{result.shipment.reference}</p>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">{t("statusLabel")}</dt>
                  <dd className="mt-1">
                    <ShipmentStatusBadge status={result.shipment.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{tc("service")}</dt>
                  <dd className="mt-1 text-sm font-medium">{ts(`${result.shipment.serviceCode}.title`)}</dd>
                </div>
                {result.shipment.etaFrom && result.shipment.etaTo && (
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("eta")}</dt>
                    <dd className="mt-1 font-medium">
                      {t("etaRange", {
                        from: format.dateTime(new Date(result.shipment.etaFrom), { dateStyle: "medium" }),
                        to: format.dateTime(new Date(result.shipment.etaTo), { dateStyle: "medium" }),
                      })}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section aria-labelledby="history">
              <h2 id="history" className="text-xl font-semibold">
                {t("historyTitle")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("timezoneNote")}</p>
              <div className="mt-5">{result.shipment.events.length ? <MilestoneTimeline events={result.shipment.events} /> : <p className="text-muted-foreground">{t("noEvents")}</p>}</div>
            </section>
          </div>
        ) : (
          <Alert variant={result.code === "unavailable" ? "info" : "warning"} className="mt-8">
            {errorMessage}
          </Alert>
        )}

        <section className="mt-10 space-y-6 border-t pt-8">
          <TrackSearch locale={locale} defaultValue={result.ok ? undefined : reference} />
          <div>
            <p className="mb-3 text-sm text-muted-foreground">{t("help")}</p>
            <ContactChannels />
          </div>
        </section>
      </Container>
    </>
  );
}
