import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { getShipmentForStaff } from "@/lib/services/shipments";
import { AddEventForm, EventVisibilityToggle, NoteForm, StaffUploadForm, UpdateShipmentForm } from "@/components/admin/admin-forms";
import { documentUploadsAvailable } from "@/lib/config/env";
import { listShipmentMessages } from "@/lib/services/cases";
import { listRecordDocumentsForStaff } from "@/lib/services/documents";
import { listEmailsForShipment } from "@/lib/services/notifications";
import { DocumentList } from "@/components/app/document-list";
import { PageHeader } from "@/components/app/page-header";
import { ShipmentStatusBadge } from "@/components/app/status-badge";
import type { ShipmentStatus } from "@/lib/domain/enums";
import type { ShipmentHistoryEntry } from "@/lib/domain/shipment-history";

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
  const tsh = await getTranslations("status.shipment");
  const tdoc = await getTranslations("documents");
  const tpd = await getTranslations("portal.documents");
  const tsh2 = await getTranslations("admin.shipment");
  const emails = await listEmailsForShipment(getDb(), user, shipment.id);
  const documents = await listRecordDocumentsForStaff(getDb(), user, "shipment", shipment.id);
  const dateTime = (d: Date | string) => format.dateTime(new Date(d), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" });
  const statusLabel = (s: ShipmentStatus | null) => (s ? tsh(s) : "—");
  const actorLabel = (actor: string | null) =>
    actor === null ? t("actorSystem") : actor === user.id ? t("actorYou") : (shipment.actorNames[actor] ?? t("actorStaff", { id: actor.slice(0, 8) }));
  const historyText = (h: ShipmentHistoryEntry): string => {
    switch (h.kind) {
      case "created":
        return t("historyCreated", { status: statusLabel(h.status) });
      case "status":
        return t("historyStatus", { from: statusLabel(h.from), to: statusLabel(h.to) }) + (h.etaChanged ? ` · ${t("historyEta")}` : "");
      case "eta":
        return t("historyEta");
      case "milestone":
        return t("historyMilestone", { milestone: h.milestone ? tm(h.milestone) : "—", visibility: h.public ? tc("visibleToCustomer") : tc("internalOnly") });
      case "visibility":
        return t(h.public ? "historyShown" : "historyHidden");
      case "milestoneEdited":
        return t("historyMilestoneEdited");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={shipment.reference}
        description={`${ts(`${shipment.serviceCode}.title`)} · ${shipment.customerName}`}
        actions={<ShipmentStatusBadge status={shipment.status} />}
      />
      <section aria-labelledby="details" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="details" className="mb-4 text-lg font-semibold">
          {t("details")}
        </h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{tc("customer")}</dt>
            <dd className="font-medium">{shipment.customerName}</dd>
            <dd className="break-all text-muted-foreground">{shipment.customerEmail}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("quoteRequest")}</dt>
            <dd>
              <Link href={`/admin/quotes/${shipment.quoteReference}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {shipment.quoteReference}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{tc("service")}</dt>
            <dd className="font-medium">{ts(`${shipment.serviceCode}.title`)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{tc("created")}</dt>
            <dd>{dateTime(shipment.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{tc("updated")}</dt>
            <dd>{dateTime(shipment.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("eta")}</dt>
            <dd>
              {shipment.etaFrom && shipment.etaTo
                ? `${format.dateTime(new Date(shipment.etaFrom), { dateStyle: "medium", timeZone: "UTC" })} – ${format.dateTime(new Date(shipment.etaTo), { dateStyle: "medium", timeZone: "UTC" })}`
                : t("notRecorded")}
              {shipment.etaFrom && shipment.etaTo && <span className="block text-muted-foreground">{shipment.etaVisible ? tc("visibleToCustomer") : tc("internalOnly")}</span>}
            </dd>
          </div>
        </dl>
      </section>
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
        {!shipment.events.length && <p className="text-sm text-muted-foreground">{t("noEvents")}</p>}
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
      <section aria-labelledby="shipment-history" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="shipment-history" className="mb-1 text-lg font-semibold">
          {t("history")}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("historyHint")}</p>
        {shipment.history.length ? (
          <ol className="space-y-2 text-sm">
            {shipment.history.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="whitespace-nowrap text-muted-foreground">{dateTime(h.at)}</span>
                <span className="font-medium">{historyText(h)}</span>
                <span className="text-muted-foreground">· {actorLabel(h.actor)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
        )}
      </section>
      <section aria-labelledby="shipment-emails" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="shipment-emails" className="mb-4 text-lg font-semibold">
          {tcase("emails")}
        </h2>
        {emails.length ? (
          <ul className="space-y-2 text-sm">
            {emails.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b pb-2">
                <span>
                  {e.template} <span className="text-muted-foreground">({e.audience})</span>
                  <span className="ml-2 text-xs text-muted-foreground">{dateTime(e.createdAt)}</span>
                </span>
                <span className={e.status === "DEAD" || e.status === "BOUNCED" || e.status === "FAILED" || e.status === "COMPLAINED" ? "font-semibold text-destructive" : "text-muted-foreground"}>
                  {e.status}
                  {e.attempts > 1 ? ` · ${e.attempts}×` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{tsh2("noEmails")}</p>
        )}
      </section>
      <section aria-labelledby="documents" className="rounded-xl border bg-card p-5 md:p-6">
        <h2 id="documents" className="mb-4 text-lg font-semibold">
          {tdoc("title")}
        </h2>
        <DocumentList documents={documents} audience="staff" />
        {documentUploadsAvailable() ? (
          <StaffUploadForm locale={locale} ownerType="shipment" ownerId={shipment.id} />
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">{tpd("unavailable")}</p>
        )}
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
