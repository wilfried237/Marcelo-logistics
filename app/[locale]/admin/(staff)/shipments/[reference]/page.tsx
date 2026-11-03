import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { getShipmentForStaff } from "@/lib/services/shipments";
import { AddEventForm, EventVisibilityToggle, NoteForm, UpdateShipmentForm } from "@/components/admin/admin-forms";
import { listShipmentMessages } from "@/lib/services/cases";
import { PageHeader } from "@/components/app/page-header";
import { ShipmentStatusBadge } from "@/components/app/status-badge";

/** Current time in Europe/Dublin formatted for <input type="datetime-local">. */
function dublinNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}

export default async function AdminShipmentDetail({ params }: { params: Promise<{ locale: string; reference: string }> }) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, `/admin/shipments/${reference}`);
  const shipment = await getShipmentForStaff(getDb(), user, reference);
  if (!shipment) notFound();
  const t = await getTranslations("admin.shipment");
  const tm = await getTranslations("milestones");
  const tc = await getTranslations("common");
  const ts = await getTranslations("services");
  const format = await getFormatter();
  const tcase = await getTranslations("admin.case");
  const messages = await listShipmentMessages(getDb(), user, shipment.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={shipment.reference}
        description={`${ts(`${shipment.serviceCode}.title`)} · ${shipment.customerName}`}
        actions={<ShipmentStatusBadge status={shipment.status} />}
      />
      <p className="text-sm">
        <Link href={`/admin/quotes/${shipment.quoteReference}`} className="font-medium text-primary underline-offset-4 hover:underline">
          {shipment.quoteReference}
        </Link>
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="update" className="rounded-xl border bg-card p-5 md:p-6">
          <h2 id="update" className="mb-4 text-lg font-semibold">
            {t("update")}
          </h2>
          <UpdateShipmentForm
            locale={locale}
            shipmentId={shipment.id}
            status={shipment.status}
            etaFrom={shipment.etaFrom}
            etaTo={shipment.etaTo}
            etaVisible={shipment.etaVisible}
          />
        </section>
        <section aria-labelledby="add" className="rounded-xl border bg-card p-5 md:p-6">
          <h2 id="add" className="mb-4 text-lg font-semibold">
            {t("addEvent")}
          </h2>
          <AddEventForm locale={locale} shipmentId={shipment.id} reference={shipment.reference} now={dublinNow()} />
        </section>
      </div>
      <section aria-labelledby="events" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="events" className="mb-4 text-lg font-semibold">
          {t("events")}
        </h2>
        <ul className="divide-y">
          {shipment.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div>
                <p className="font-medium">
                  {tm(e.milestone)}
                  <span className="ml-2 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">{e.public ? tc("visibleToCustomer") : tc("internalOnly")}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(e.occurredAt), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" })}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
                {(e.noteEn || e.noteFr) && (
                  <p className="mt-1 text-sm">
                    {e.noteEn && <span lang="en">EN: {e.noteEn}</span>}
                    {e.noteEn && e.noteFr && " · "}
                    {e.noteFr && <span lang="fr">FR: {e.noteFr}</span>}
                  </p>
                )}
              </div>
              <EventVisibilityToggle locale={locale} eventId={e.id} isPublic={e.public} />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="case" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="case" className="mb-4 text-lg font-semibold">
          {tcase("shipmentMessages")}
        </h2>
        {messages.length ? (
          <ol className="mb-6 space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={`border-l-4 p-3 text-sm ${m.internal ? "border-warning bg-warning-soft" : "border-brand bg-secondary"}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tcase(`kinds.${m.kind}` as "kinds.note")} · {format.dateTime(new Date(m.createdAt), { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Dublin" })}
                </p>
                <p className="mt-1 whitespace-pre-line">{m.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mb-6 text-sm text-muted-foreground">{tcase("noMessages")}</p>
        )}
        <NoteForm locale={locale} requestId={shipment.quoteRequestId} shipmentId={shipment.id} />
      </section>
    </div>
  );
}
