"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, ConfirmSubmit } from "@/components/app/action-form";
import { FormField, inputClassName, selectClassName } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import { CURRENCIES, MILESTONE_CODES, SHIPMENT_STATUSES, USER_ROLES, type QuoteStatus, type ShipmentStatus, type UserRole } from "@/lib/domain/enums";
import { QUOTE_TRANSITIONS } from "@/lib/domain/quote-lifecycle";
import { calculateQuote, formatMinor, type LineInput } from "@/lib/domain/pricing";
import { STATUS_MILESTONES, canMoveShipment } from "@/lib/domain/shipment-lifecycle";
import { Button } from "@/components/ui/button";
import {
  addEventAction,
  createShipmentAction,
  inviteUserAction,
  issueQuoteAction,
  addNoteAction,
  requestInfoAction,
  assignAction,
  contactStatusAction,
  setRoleAction,
  toggleEventVisibilityAction,
  transitionAction,
  updateShipmentAction,
} from "@/app/[locale]/admin/actions";

/** Staff-initiated transitions only (customers accept/decline; expiry is automatic). */
const STAFF_TARGETS = (from: QuoteStatus) => QUOTE_TRANSITIONS[from].filter((s) => s !== "ACCEPTED" && s !== "DECLINED" && s !== "EXPIRED" && s !== "QUOTED");

export function TransitionForm({ locale, requestId, status }: { locale: string; requestId: string; status: QuoteStatus }) {
  const t = useTranslations("admin.quote");
  const ts = useTranslations("status.quote");
  const targets = STAFF_TARGETS(status);
  const [to, setTo] = useState<QuoteStatus | "">(targets[0] ?? "");
  if (!targets.length) return null;
  return (
    <ActionForm action={transitionAction} className="space-y-4">
      {(state) => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="requestId" value={requestId} />
          <FormField id="to" label={t("moveTo")}>
            {(p) => (
              <select {...p} name="to" value={to} onChange={(e) => setTo(e.target.value as QuoteStatus)} className={selectClassName}>
                {targets.map((s) => (
                  <option key={s} value={s}>
                    {ts(s)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          {to === "CANCELLED" ? (
            <>
              <FormField id="reason" label={t("reasonLabel")} error={state.status === "error" ? state.fieldErrors?.reason : undefined}>
                {(p) => <Textarea {...p} name="reason" required maxLength={500} rows={3} />}
              </FormField>
              <ConfirmSubmit label={t("apply")} confirmLabel={t("apply")} description={t("confirmCancel")} variant="destructive" />
            </>
          ) : (
            <SubmitButton pendingLabel={t("apply")}>{t("apply")}</SubmitButton>
          )}
        </>
      )}
    </ActionForm>
  );
}

type EditableLine = LineInput & { key: number };

/**
 * Quotation calculator. Staff type each charge; the breakdown below is computed
 * with the same integer arithmetic the server uses (lib/domain/pricing.ts), so
 * staff see exactly how the total is built. The server recomputes everything on
 * submit and the database verifies it again; the preview is never trusted.
 */
export function QuoteCalculatorForm({
  locale,
  requestId,
  defaultValidUntil,
  taxRatesBp,
}: {
  locale: string;
  requestId: string;
  defaultValidUntil: string;
  taxRatesBp: number[];
}) {
  const t = useTranslations("admin.quote");
  const tc = useTranslations("admin.calc");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("EUR");
  const [nextKey, setNextKey] = useState(2);
  const [lines, setLines] = useState<EditableLine[]>([{ key: 1, kind: "charge", description: "", quantity: "1", unitPrice: "" }]);
  const result = useMemo(() => calculateQuote(lines, currency, taxRatesBp), [lines, currency, taxRatesBp]);
  const money = (v: bigint) => formatMinor(v, currency, locale);
  const update = (key: number, patch: Partial<EditableLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const add = (kind: EditableLine["kind"]) => {
    setLines((ls) => [...ls, kind === "tax" ? { key: nextKey, kind, description: tc("taxDefault"), rateBp: taxRatesBp[0] } : { key: nextKey, kind, description: "", quantity: "1", unitPrice: "" }]);
    setNextKey((k) => k + 1);
  };
  const payload = JSON.stringify(lines.map((l) => ({ kind: l.kind, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, rateBp: l.rateBp })));

  return (
    <ActionForm action={issueQuoteAction} className="space-y-5">
      {(state) => {
        const fe = state.status === "error" ? state.fieldErrors : undefined;
        return state.status === "ok" ? null : (
          <>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="lines" value={payload} />
            <p className="text-sm text-muted-foreground">{tc("hint")}</p>
            <FormField id="currency" label={t("currency")}>
              {(p) => (
                <select {...p} name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)} className={selectClassName}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
            </FormField>

            <fieldset className="space-y-3">
              <legend className="mb-2 font-semibold">{tc("lines")}</legend>
              {lines.map((line, index) => {
                const priced = result.ok ? result.value.lines[index] : undefined;
                return (
                  <div key={line.key} className="grid gap-2 border bg-background p-3 sm:grid-cols-[8rem_1fr_6rem_8rem_auto] sm:items-end">
                    <FormField id={`kind-${line.key}`} label={tc("kind")}>
                      {(p) => (
                        <select {...p} value={line.kind} onChange={(e) => update(line.key, { kind: e.target.value as EditableLine["kind"] })} className={selectClassName}>
                          <option value="charge">{tc("charge")}</option>
                          <option value="discount">{tc("discount")}</option>
                          {taxRatesBp.length > 0 && <option value="tax">{tc("tax")}</option>}
                        </select>
                      )}
                    </FormField>
                    <FormField id={`desc-${line.key}`} label={tc("description")} error={fe?.[`lines.${index}.description`]}>
                      {(p) => <Input {...p} value={line.description} maxLength={200} onChange={(e) => update(line.key, { description: e.target.value })} className={inputClassName} />}
                    </FormField>
                    {line.kind === "tax" ? (
                      <FormField id={`rate-${line.key}`} label={tc("rate")} className="sm:col-span-2">
                        {(p) => (
                          <select {...p} value={line.rateBp} onChange={(e) => update(line.key, { rateBp: Number(e.target.value) })} className={selectClassName}>
                            {taxRatesBp.map((r) => (
                              <option key={r} value={r}>
                                {r / 100} %
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    ) : (
                      <>
                        <FormField id={`qty-${line.key}`} label={tc("quantity")}>
                          {(p) => <Input {...p} value={line.quantity} inputMode="decimal" onChange={(e) => update(line.key, { quantity: e.target.value })} className={inputClassName} />}
                        </FormField>
                        <FormField id={`price-${line.key}`} label={tc("unitPrice", { currency })}>
                          {(p) => <Input {...p} value={line.unitPrice} inputMode="decimal" placeholder="0.00" onChange={(e) => update(line.key, { unitPrice: e.target.value })} className={inputClassName} />}
                        </FormField>
                      </>
                    )}
                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                      <span className="text-sm tabular-nums" aria-label={tc("lineAmount")}>
                        {priced ? money(priced.lineTotalMinor) : "–"}
                      </span>
                      {lines.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}>
                          {tc("remove")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => add("charge")}>
                  {tc("addCharge")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => add("discount")}>
                  {tc("addDiscount")}
                </Button>
                {taxRatesBp.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => add("tax")}>
                    {tc("addTax")}
                  </Button>
                )}
              </div>
              {taxRatesBp.length === 0 && <p className="text-xs text-muted-foreground">{tc("noTax")}</p>}
            </fieldset>

            <dl className="divide-y border bg-secondary/40 text-sm" aria-live="polite">
              {result.ok ? (
                <>
                  <div className="flex justify-between px-4 py-2">
                    <dt>{tc("charges")}</dt>
                    <dd className="tabular-nums">{money(result.value.chargesMinor)}</dd>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <dt>{tc("discounts")}</dt>
                    <dd className="tabular-nums">{money(result.value.discountsMinor)}</dd>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <dt>{tc("subtotal")}</dt>
                    <dd className="tabular-nums">{money(result.value.subtotalMinor)}</dd>
                  </div>
                  {result.value.taxMinor > 0n && (
                    <div className="flex justify-between px-4 py-2">
                      <dt>{tc("tax")}</dt>
                      <dd className="tabular-nums">{money(result.value.taxMinor)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-3 text-base font-semibold">
                    <dt>{tc("total")}</dt>
                    <dd className="tabular-nums">{money(result.value.totalMinor)}</dd>
                  </div>
                </>
              ) : (
                <div className="px-4 py-3 text-warning" role="status">
                  {tc(`errors.${result.error.code}`, { line: "line" in result.error ? result.error.line : 0 })}
                </div>
              )}
            </dl>
            {fe?.lines && <p className="text-sm font-medium text-destructive">{tc(`errors.${fe.lines}` as "errors.no_lines", { line: 0 })}</p>}

            <FormField id="validUntil" label={t("validUntil")} error={fe?.validUntil}>
              {(p) => <Input {...p} name="validUntil" type="date" required defaultValue={defaultValidUntil} className={inputClassName} />}
            </FormField>
            <FormField id="inclusions" label={t("inclusions")} error={fe?.inclusions}>
              {(p) => <Textarea {...p} name="inclusions" maxLength={2000} rows={3} />}
            </FormField>
            <FormField id="exclusions" label={t("exclusions")} error={fe?.exclusions}>
              {(p) => <Textarea {...p} name="exclusions" maxLength={2000} rows={3} />}
            </FormField>
            {result.ok ? (
              <ConfirmSubmit label={t("send")} confirmLabel={t("send")} description={tc("confirm", { total: money(result.value.totalMinor) })} />
            ) : (
              <Button type="button" disabled>
                {t("send")}
              </Button>
            )}
          </>
        );
      }}
    </ActionForm>
  );
}

/** Internal note (never visible to the customer). */
export function NoteForm({ locale, requestId, shipmentId }: { locale: string; requestId: string; shipmentId?: string }) {
  const t = useTranslations("admin.case");
  return (
    <ActionForm action={addNoteAction} className="space-y-3">
      {(state) => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="requestId" value={requestId} />
          {shipmentId && <input type="hidden" name="shipmentId" value={shipmentId} />}
          <FormField id={`note-${shipmentId ?? requestId}`} label={t("noteLabel")} error={state.status === "error" ? state.fieldErrors?.body : undefined}>
            {(p) => <Textarea {...p} name="body" required maxLength={4000} rows={3} />}
          </FormField>
          <p className="text-xs text-muted-foreground">{t("noteHint")}</p>
          <SubmitButton pendingLabel={t("addNote")}>{t("addNote")}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Asks the customer for information (visible to them; emailed; status -> AWAITING_CUSTOMER). */
export function RequestInfoForm({ locale, requestId }: { locale: string; requestId: string }) {
  const t = useTranslations("admin.case");
  return (
    <ActionForm action={requestInfoAction} className="space-y-3">
      {(state) => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="requestId" value={requestId} />
          <FormField id="info-body" label={t("infoLabel")} error={state.status === "error" ? state.fieldErrors?.body : undefined}>
            {(p) => <Textarea {...p} name="body" required maxLength={4000} rows={4} />}
          </FormField>
          <p className="text-xs text-muted-foreground">{t("infoHint")}</p>
          <ConfirmSubmit label={t("requestInfo")} confirmLabel={t("requestInfo")} description={t("infoHint")} />
        </>
      )}
    </ActionForm>
  );
}

export function AssignForm({ locale, requestId, assignedTo, staff }: { locale: string; requestId: string; assignedTo: string | null; staff: { id: string; email: string }[] }) {
  const t = useTranslations("admin.case");
  return (
    <ActionForm action={assignAction} className="flex flex-wrap items-end gap-3">
      {() => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="requestId" value={requestId} />
          <FormField id="assigneeId" label={t("assignee")} className="min-w-56 flex-1">
            {(p) => (
              <select {...p} name="assigneeId" defaultValue={assignedTo ?? ""} className={selectClassName}>
                <option value="">{t("unassigned")}</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <SubmitButton pendingLabel={t("assign")}>{t("assign")}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ContactStatusForm({ locale, id, status }: { locale: string; id: string; status: string }) {
  const t = useTranslations("admin.enquiries");
  return (
    <ActionForm action={contactStatusAction} className="flex flex-wrap items-end gap-2">
      {() => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={id} />
          <select name="status" defaultValue={status} aria-label={t("status")} className={selectClassName}>
            {(["NEW", "IN_PROGRESS", "CLOSED"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
          <SubmitButton pendingLabel={t("update")}>{t("update")}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function CreateShipmentForm({ locale, requestId }: { locale: string; requestId: string }) {
  const t = useTranslations("admin.quote");
  return (
    <ActionForm action={createShipmentAction} className="space-y-3">
      {(state) =>
        state.status === "ok" ? null : (
          <>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="requestId" value={requestId} />
            <SubmitButton pendingLabel={t("createShipment")}>{t("createShipment")}</SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}

export function UpdateShipmentForm({
  locale,
  shipmentId,
  status,
  etaFrom,
  etaTo,
  etaVisible,
}: {
  locale: string;
  shipmentId: string;
  status: ShipmentStatus;
  etaFrom: string | null;
  etaTo: string | null;
  etaVisible: boolean;
}) {
  const t = useTranslations("admin.shipment");
  const ts = useTranslations("status.shipment");
  const tm = useTranslations("milestones");
  const tc = useTranslations("common");
  const [selected, setSelected] = useState<ShipmentStatus>(status);
  const offered = selected !== status ? STATUS_MILESTONES[selected] : undefined;
  return (
    <ActionForm action={updateShipmentAction} className="space-y-4">
      {(state) => {
        const fe = state.status === "error" ? state.fieldErrors : undefined;
        return (
          <>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="shipmentId" value={shipmentId} />
            <FormField id="status" label={tc("status")}>
              {(p) => (
                <select {...p} name="status" value={selected} onChange={(e) => setSelected(e.target.value as ShipmentStatus)} className={selectClassName}>
                  {SHIPMENT_STATUSES.filter((s) => canMoveShipment(status, s)).map((s) => (
                    <option key={s} value={s}>
                      {ts(s)}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            {offered && (
              // Keyed by status so the approved defaults apply each time another status is chosen.
              <fieldset key={selected} className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">{t("statusMilestoneLegend")}</legend>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" name="recordMilestone" defaultChecked={offered.record} className="h-4 w-4" />
                  {t("recordMilestone", { milestone: tm(offered.milestone) })}
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" name="milestonePublic" defaultChecked={offered.public} className="h-4 w-4" />
                  {t("milestonePublic")}
                </label>
                <p className="text-xs text-muted-foreground">{t("recordMilestoneHint")}</p>
              </fieldset>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="etaFrom" label={t("etaFrom")} error={fe?.etaFrom}>
                {(p) => <Input {...p} name="etaFrom" type="date" defaultValue={etaFrom ?? ""} className={inputClassName} />}
              </FormField>
              <FormField id="etaTo" label={t("etaTo")} error={fe?.etaTo}>
                {(p) => <Input {...p} name="etaTo" type="date" defaultValue={etaTo ?? ""} className={inputClassName} />}
              </FormField>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" name="etaVisible" defaultChecked={etaVisible} className="h-4 w-4" />
              {t("etaVisible")}
            </label>
            <SubmitButton pendingLabel={tc("saving")}>{tc("save")}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}

export function AddEventForm({ locale, shipmentId, reference, now }: { locale: string; shipmentId: string; reference: string; now: string }) {
  const t = useTranslations("admin.shipment");
  const tm = useTranslations("milestones");
  const tc = useTranslations("common");
  return (
    <ActionForm action={addEventAction} className="space-y-4">
      {(state) => {
        const fe = state.status === "error" ? state.fieldErrors : undefined;
        return (
          <>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="shipmentId" value={shipmentId} />
            <input type="hidden" name="reference" value={reference} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="milestone" label={t("milestone")}>
                {(p) => (
                  <select {...p} name="milestone" className={selectClassName}>
                    {MILESTONE_CODES.map((m) => (
                      <option key={m} value={m}>
                        {tm(m)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField id="occurredAt" label={t("occurredAt")} error={fe?.occurredAt}>
                {(p) => <Input {...p} name="occurredAt" type="datetime-local" required defaultValue={now} className={inputClassName} />}
              </FormField>
            </div>
            <FormField id="location" label={t("location")} optionalLabel={tc("optional")} error={fe?.location}>
              {(p) => <Input {...p} name="location" maxLength={120} className={inputClassName} />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="noteEn" label={t("noteEn")} optionalLabel={tc("optional")} error={fe?.noteEn}>
                {(p) => <Textarea {...p} name="noteEn" maxLength={1000} rows={2} lang="en" />}
              </FormField>
              <FormField id="noteFr" label={t("noteFr")} optionalLabel={tc("optional")} error={fe?.noteFr}>
                {(p) => <Textarea {...p} name="noteFr" maxLength={1000} rows={2} lang="fr" />}
              </FormField>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="public" className="mt-0.5 h-4 w-4" aria-describedby="public-hint" />
              <span>
                {t("public")}
                <span id="public-hint" className="block text-xs text-muted-foreground">
                  {t("publicHint")}
                </span>
              </span>
            </label>
            <SubmitButton pendingLabel={t("record")}>{t("record")}</SubmitButton>
          </>
        );
      }}
    </ActionForm>
  );
}

export function EventVisibilityToggle({ locale, eventId, isPublic }: { locale: string; eventId: string; isPublic: boolean }) {
  const t = useTranslations("admin.shipment");
  return (
    <ActionForm action={toggleEventVisibilityAction} className="space-y-2">
      {() => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="visible" value={isPublic ? "false" : "true"} />
          <SubmitButton pendingLabel="…" variant="outline" size="sm">
            {isPublic ? t("makeInternal") : t("makePublic")}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RoleForm({ locale, userId, role, label }: { locale: string; userId: string; role: UserRole; label: string }) {
  const t = useTranslations("admin.users");
  return (
    <ActionForm action={setRoleAction} className="flex flex-wrap items-end gap-2">
      {() => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="userId" value={userId} />
          <label className="sr-only" htmlFor={`role-${userId}`}>
            {t("role")}: {label}
          </label>
          <select id={`role-${userId}`} name="role" defaultValue={role} className={`${selectClassName} h-9 w-auto`}>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </select>
          <SubmitButton pendingLabel="…" variant="outline" size="sm">
            {t("change")}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function InviteForm({ locale }: { locale: string }) {
  const t = useTranslations("admin.users");
  return (
    <ActionForm action={inviteUserAction} className="space-y-4">
      {() => (
        <>
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <FormField id="inviteEmail" label={t("inviteEmail")}>
              {(p) => <Input {...p} name="email" type="email" required autoComplete="off" className={inputClassName} />}
            </FormField>
            <FormField id="inviteRole" label={t("inviteRole")}>
              {(p) => (
                <select {...p} name="role" defaultValue="customer" className={selectClassName}>
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`)}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField id="inviteLocale" label="EN / FR">
              {(p) => (
                <select {...p} name="inviteLocale" defaultValue={locale} className={selectClassName}>
                  <option value="en">EN</option>
                  <option value="fr">FR</option>
                </select>
              )}
            </FormField>
          </div>
          <SubmitButton pendingLabel={t("inviteSend")}>{t("inviteSend")}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

