"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Alert } from "./alert";

export type ActionState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string; fieldErrors?: Record<string, string> };
export const IDLE: ActionState = { status: "idle" };

/**
 * Wraps a server action form and announces its result. Messages are already
 * translated by the server action; field errors are exposed to children.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: (state: ActionState) => React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  return (
    <form action={formAction} className={className} noValidate>
      {state.status === "ok" && <Alert variant="success">{state.message}</Alert>}
      {state.status === "error" && <Alert variant="danger">{state.message}</Alert>}
      {children(state)}
    </form>
  );
}

/**
 * Two-step confirmation for consequential actions without browser dialogs:
 * the first click reveals the consequence and an explicit confirm button.
 */
export function ConfirmSubmit({
  label,
  confirmLabel,
  description,
  variant = "default",
  name,
  value,
}: {
  label: string;
  confirmLabel: string;
  description: string;
  variant?: "default" | "destructive" | "outline";
  name?: string;
  value?: string;
}) {
  const t = useTranslations("common");
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <Button type="button" variant={variant} onClick={() => setArmed(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div className="w-full space-y-3 rounded-lg border bg-secondary/50 p-4" role="group" aria-label={label}>
      <p className="text-sm">{description}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={variant} name={name} value={value} autoFocus>
          {confirmLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
