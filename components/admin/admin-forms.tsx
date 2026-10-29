"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, ConfirmSubmit } from "@/components/app/action-form";
import { FormField, inputClassName, selectClassName } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import { CURRENCIES, MILESTONE_CODES, SHIPMENT_STATUSES, USER_ROLES, type QuoteStatus, type ShipmentStatus, type UserRole } from "@/lib/domain/enums";
import { QUOTE_TRANSITIONS } from "@/lib/domain/quote-lifecycle";
import {
  addEventAction,
  createShipmentAction,
  inviteUserAction,
  sendQuoteAction,
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

export function SendQuoteForm({ locale, requestId, defaultValidUntil }: { locale: string; requestId: string; defaultValidUntil: string }) {
  const t = useTranslations("admin.quote");
  return (
    <ActionForm action={sendQuoteAction} className="space-y-4">
      {(state) => {
        const fe = state.status === "error" ? state.fieldErrors : undefined;
        return state.status === "ok" ? null : (
          <>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="requestId" value={requestId} />
            <p className="text-sm text-muted-foreground">{t("sendQuoteHint")}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="amount" label={t("amount")} error={fe?.amount} className="sm:col-span-2">
                {(p) => <Input {...p} name="amount" inputMode="decimal" required placeholder="450.00" className={inputClassName} />}
              </FormField>
              <FormField id="currency" label={t("currency")}>
                {(p) => (
                  <select {...p} name="currency" className={selectClassName}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                )}
              </FormField>
            </div>
            <FormField id="validUntil" label={t("validUntil")} error={fe?.validUntil}>
              {(p) => <Input {...p} name="validUntil" type="date" required defaultValue={defaultValidUntil} className={inputClassName} />}
            </FormField>
            <FormField id="inclusions" label={t("inclusions")} error={fe?.inclusions}>
              {(p) => <Textarea {...p} name="inclusions" maxLength={2000} rows={3} />}
            </FormField>
            <FormField id="exclusions" label={t("exclusions")} error={fe?.exclusions}>
              {(p) => <Textarea {...p} name="exclusions" maxLength={2000} rows={3} />}
            </FormField>
            <ConfirmSubmit label={t("send")} confirmLabel={t("send")} description={t("sendQuoteHint")} />
          </>
        );
      }}
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
  const tc = useTranslations("common");
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
                <select {...p} name="status" defaultValue={status} className={selectClassName}>
                  {SHIPMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ts(s)}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
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
