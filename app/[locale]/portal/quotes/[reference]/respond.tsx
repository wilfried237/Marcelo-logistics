"use client";

import { useTranslations } from "next-intl";
import { ActionForm, ConfirmSubmit } from "@/components/app/action-form";
import { respondToQuoteAction } from "../../actions";

/** Accept/decline with an explicit confirmation step naming the consequence. */
export function RespondToQuote({ locale, reference, amount }: { locale: string; reference: string; amount: string }) {
  const t = useTranslations("portal.quoteDetail");
  return (
    <ActionForm action={respondToQuoteAction} className="space-y-3">
      {(state) =>
        state.status === "ok" ? null : (
          <>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="reference" value={reference} />
            <div className="flex flex-wrap gap-3">
              <ConfirmSubmit label={t("accept")} confirmLabel={t("accept")} description={t("confirmAccept", { amount })} name="decision" value="accept" />
              <ConfirmSubmit label={t("decline")} confirmLabel={t("decline")} description={t("confirmDecline")} variant="outline" name="decision" value="decline" />
            </div>
          </>
        )
      }
    </ActionForm>
  );
}
