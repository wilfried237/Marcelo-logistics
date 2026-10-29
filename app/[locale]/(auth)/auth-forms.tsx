"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/app/alert";
import { FormField, inputClassName } from "@/components/app/form-field";
import { SubmitButton } from "@/components/app/submit-button";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction, type AuthFormState } from "./actions";

const initial: AuthFormState = { status: "idle" };

function useFieldError(state: AuthFormState) {
  const tv = useTranslations("validation");
  return (field: string) => {
    if (state.status !== "error" || !state.fieldErrors?.[field]) return undefined;
    return tv(state.fieldErrors[field] as "required");
  };
}

function FormError({ state }: { state: AuthFormState }) {
  const t = useTranslations("auth.errors");
  if (state.status !== "error" || state.code === "validation") return null;
  return <Alert variant="danger">{t(state.code as "generic")}</Alert>;
}

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <FormError state={state} />
      <FormField id="email" label={t("email")}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required className={inputClassName} />}
      </FormField>
      <FormField id="password" label={t("password")}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required className={inputClassName} />}
      </FormField>
      <SubmitButton pendingLabel={t("signingIn")} className="w-full" size="lg">
        {t("signIn")}
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("forgotLink")}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(registerAction, initial);
  const fieldError = useFieldError(state);
  if (state.status === "sent") return <Alert variant="success" title={t("checkEmailTitle")}>{t("checkEmailBody")}</Alert>;
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormError state={state} />
      <FormField id="fullName" label={t("fullName")} error={fieldError("fullName")}>
        {(p) => <Input {...p} name="fullName" autoComplete="name" required maxLength={120} className={inputClassName} />}
      </FormField>
      <FormField id="email" label={t("email")} error={fieldError("email")}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required className={inputClassName} />}
      </FormField>
      <FormField id="password" label={t("password")} hint={t("passwordHint")} error={fieldError("password")}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={12} className={inputClassName} />}
      </FormField>
      <div className="space-y-1">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" className="mt-1 h-4 w-4" aria-describedby={fieldError("consent") ? "consent-error" : undefined} />
          <span>{t("consent")}</span>
        </label>
        {fieldError("consent") && (
          <p id="consent-error" className="text-sm font-medium text-destructive">
            {fieldError("consent")}
          </p>
        )}
      </div>
      <SubmitButton pendingLabel={t("creatingAccount")} className="w-full" size="lg">
        {t("createAccount")}
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(forgotPasswordAction, initial);
  const fieldError = useFieldError(state);
  if (state.status === "sent") return <Alert variant="success" title={t("checkEmailTitle")}>{t("checkEmailBody")}</Alert>;
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormError state={state} />
      <FormField id="email" label={t("email")} error={fieldError("email")}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" required className={inputClassName} />}
      </FormField>
      <SubmitButton pendingLabel={t("sendingLink")} className="w-full" size="lg">
        {t("sendLink")}
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(resetPasswordAction, initial);
  const fieldError = useFieldError(state);
  if (state.status === "done")
    return (
      <Alert variant="success" title={t("passwordUpdated")}>
        <Link href="/portal" className="font-medium underline">
          {t("signIn")}
        </Link>
      </Alert>
    );
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormError state={state} />
      <FormField id="password" label={t("newPassword")} hint={t("passwordHint")} error={fieldError("password")}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={12} className={inputClassName} />}
      </FormField>
      <FormField id="confirm" label={t("confirmPassword")} error={fieldError("confirm")}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required className={inputClassName} />}
      </FormField>
      <SubmitButton pendingLabel={t("updatingPassword")} className="w-full" size="lg">
        {t("updatePassword")}
      </SubmitButton>
    </form>
  );
}
