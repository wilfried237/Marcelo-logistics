"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/app/alert";
import { FormField, inputClassName, selectClassName } from "@/components/app/form-field";
import { Link } from "@/i18n/navigation";
import { submitContactAction, type ContactActionResult } from "@/app/[locale]/(site)/contact/actions";

/** Contact form: validated on the server, persisted before success is shown. */
export function ContactForm() {
  const t = useTranslations("contactForm");
  const tv = useTranslations("validation");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ContactActionResult | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const errors = result && !result.ok && "fieldErrors" in result ? (result.fieldErrors ?? {}) : {};
  const err = (name: string) => (errors[name] ? tv(errors[name] as "required") : undefined);

  if (result?.ok) {
    return (
      <div className="space-y-4 border-l-4 border-brand bg-secondary p-6" role="status">
        <h2 className="text-2xl font-bold tracking-tight">{t("successTitle")}</h2>
        <p>{t("successBody", { reference: result.reference })}</p>
        <p className="text-sm text-muted-foreground">{result.emailSent ? t("emailSent") : t("emailNotSent")}</p>
        <Button
          variant="outline"
          onClick={() => {
            setResult(null);
            setKey(crypto.randomUUID());
          }}
        >
          {t("another")}
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () =>
          setResult(
            await submitContactAction({
              name: fd.get("name"),
              email: fd.get("email"),
              phone: fd.get("phone"),
              topic: fd.get("topic"),
              relatedReference: fd.get("relatedReference"),
              message: fd.get("message"),
              locale,
              idempotencyKey: key,
              privacyAccepted: fd.get("privacy") === "on",
              website: fd.get("website"),
            }),
          ),
        );
      }}
    >
      {result && !result.ok && (
        <Alert variant="danger">{result.code === "rate_limited" ? t("errors.rateLimited") : result.code === "unavailable" ? t("errors.unavailable") : result.code === "invalid" ? t("errors.invalid") : t("errors.generic")}</Alert>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="name" label={t("name")} error={err("name")}>
          {(p) => <Input {...p} name="name" required maxLength={120} autoComplete="name" className={inputClassName} />}
        </FormField>
        <FormField id="email" label={t("email")} error={err("email")}>
          {(p) => <Input {...p} name="email" type="email" required maxLength={254} autoComplete="email" className={inputClassName} />}
        </FormField>
        <FormField id="phone" label={t("phone")} hint={t("phoneHint")} optionalLabel={t("optional")} error={err("phone")}>
          {(p) => <Input {...p} name="phone" type="tel" maxLength={32} autoComplete="tel" placeholder="+353 …" className={inputClassName} />}
        </FormField>
        <FormField id="topic" label={t("topic")} error={err("topic")}>
          {(p) => (
            <select {...p} name="topic" defaultValue="general" className={selectClassName}>
              <option value="quote">{t("topics.quote")}</option>
              <option value="shipment">{t("topics.shipment")}</option>
              <option value="general">{t("topics.general")}</option>
            </select>
          )}
        </FormField>
      </div>
      <FormField id="relatedReference" label={t("reference")} hint={t("referenceHint")} optionalLabel={t("optional")} error={err("relatedReference")}>
        {(p) => <Input {...p} name="relatedReference" maxLength={20} autoCapitalize="characters" className={`${inputClassName} max-w-xs font-mono`} />}
      </FormField>
      <FormField id="message" label={t("message")} error={err("message")}>
        {(p) => <Textarea {...p} name="message" required minLength={10} maxLength={4000} rows={6} />}
      </FormField>
      {/* Honeypot: hidden from people and assistive technology. */}
      <div aria-hidden className="absolute left-[-10000px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="space-y-1">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="privacy" required className="mt-1 h-4 w-4" aria-describedby={errors.privacyAccepted ? "privacy-error" : undefined} />
          <span>
            {t.rich("privacy", { link: (chunks) => <Link href="/privacy" className="text-primary underline">{chunks}</Link> })}
          </span>
        </label>
        {errors.privacyAccepted && (
          <p id="privacy-error" className="text-sm font-medium text-destructive">
            {tv("consent_required")}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("sending") : t("send")}
      </Button>
    </form>
  );
}
