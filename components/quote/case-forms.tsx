"use client";

import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, ConfirmSubmit, type ActionState } from "@/components/app/action-form";
import { FormField } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

/** Accept or decline a quotation (two-step confirmation). Works for signed links and the portal. */
export function RespondForm({ action, locale, hidden }: { action: Action; locale: string; hidden: Record<string, string> }) {
  const t = useTranslations("quoteView");
  return (
    <ActionForm action={action} className="space-y-3">
      {(state) =>
        state.status === "ok" ? null : (
          <>
            <input type="hidden" name="locale" value={locale} />
            {Object.entries(hidden).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <div className="flex flex-wrap gap-3">
              <ConfirmSubmit label={t("accept")} confirmLabel={t("confirmAccept")} description={t("acceptConsequence")} name="decision" value="accept" />
              <ConfirmSubmit label={t("decline")} confirmLabel={t("confirmDecline")} description={t("declineConsequence")} name="decision" value="decline" variant="outline" />
            </div>
          </>
        )
      }
    </ActionForm>
  );
}

/** Free-text message to the team (reply to an information request, or a shipment issue). */
export function MessageForm({
  action,
  locale,
  hidden,
  label,
  hint,
  submit,
}: {
  action: Action;
  locale: string;
  hidden: Record<string, string>;
  label: string;
  hint?: string;
  submit: string;
}) {
  return (
    <ActionForm action={action} className="space-y-3">
      {(state) =>
        state.status === "ok" ? null : (
          <>
            <input type="hidden" name="locale" value={locale} />
            {Object.entries(hidden).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <FormField id={`message-${Object.values(hidden).join("-")}`} label={label} hint={hint} error={state.status === "error" ? state.fieldErrors?.body : undefined}>
              {(p) => <Textarea {...p} name="body" required maxLength={4000} rows={5} />}
            </FormField>
            <SubmitButton pendingLabel={submit}>{submit}</SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}
