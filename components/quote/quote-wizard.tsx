"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/app/alert";
import { FormField, inputClassName, selectClassName } from "@/components/app/form-field";
import { SERVICE_CODES, type ServiceCode } from "@/lib/domain/services";
import { quoteRequestInputSchema } from "@/lib/domain/quote-schema";
import { submitQuoteAction, type QuoteActionResult } from "@/app/[locale]/(site)/quote/actions";
import { cn } from "@/lib/utils";

type ItemValues = {
  description: string;
  quantity: string;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  running: boolean;
};

type FormValues = {
  service: ServiceCode | "";
  originCountry: string;
  destinationCountry: string;
  destinationCity: string;
  items: ItemValues[];
  notes: string;
  contact: { name: string; email: string; phone: string };
  website: string;
};

const EMPTY_ITEM: ItemValues = { description: "", quantity: "1", weightKg: "", lengthCm: "", widthCm: "", heightCm: "", vehicleMake: "", vehicleModel: "", vehicleYear: "", running: true };
const STEPS = ["service", "route", "items", "contact", "review"] as const;
const STEP_FIELDS: Record<(typeof STEPS)[number], string[]> = {
  service: ["service"],
  route: ["originCountry", "destinationCountry", "destinationCity"],
  items: ["items", "notes"],
  contact: ["contact"],
  review: [],
};

const blank = (v: string) => (v.trim() === "" ? undefined : v.trim());

/** Shapes form values into exactly what the server schema accepts for the chosen service. */
function toPayload(values: FormValues, locale: string, idempotencyKey: string) {
  const items =
    values.service === "vehicle"
      ? values.items.map((i) => ({ vehicleMake: i.vehicleMake, vehicleModel: i.vehicleModel, vehicleYear: i.vehicleYear, running: i.running, description: blank(i.description) }))
      : values.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          weightKg: blank(i.weightKg),
          lengthCm: blank(i.lengthCm),
          widthCm: blank(i.widthCm),
          heightCm: blank(i.heightCm),
        }));
  return {
    service: values.service,
    originCountry: values.originCountry,
    destinationCountry: values.destinationCountry,
    destinationCity: values.destinationCity,
    items,
    notes: values.notes,
    contact: { name: values.contact.name, email: values.contact.email, phone: values.contact.phone },
    locale,
    idempotencyKey,
    website: values.website,
  };
}

export function QuoteWizard({
  available,
  originCountries,
  destinationCountries,
  confirmedServices,
}: {
  available: boolean;
  originCountries: string[];
  destinationCountries: string[];
  confirmedServices: string[];
}) {
  const t = useTranslations("quoteForm");
  const tv = useTranslations("validation");
  const ts = useTranslations("services");
  const th = useTranslations("home.services");
  const tc = useTranslations("common");
  const locale = useLocale();
  const countryName = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return (code: string) => names.of(code) ?? code;
  }, [locale]);

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuoteActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  // One key per form instance: a retried submission can never create a duplicate.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const headingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      service: "",
      originCountry: originCountries[0] ?? "",
      destinationCountry: destinationCountries[0] ?? "",
      destinationCity: "",
      items: [{ ...EMPTY_ITEM }],
      notes: "",
      contact: { name: "", email: "", phone: "" },
      website: "",
    },
  });
  const { register, getValues, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const service = useWatch({ control, name: "service" });
  const current = STEPS[step];

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const err = (path: string) => (errors[path] ? tv(errors[path] as "required") : undefined);

  function validate(stepName: (typeof STEPS)[number]): boolean {
    const parsed = quoteRequestInputSchema.safeParse(toPayload(getValues(), locale, idempotencyKey));
    const all: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) all[issue.path.join(".") || "service"] ??= /^[a-z_]+$/.test(issue.message) ? issue.message : "invalid";
    if (!getValues("service")) all.service = "required";
    const prefixes = stepName === "review" ? Object.values(STEP_FIELDS).flat() : STEP_FIELDS[stepName];
    const relevant = Object.fromEntries(Object.entries(all).filter(([k]) => prefixes.some((p) => k === p || k.startsWith(`${p}.`))));
    setErrors(relevant);
    if (Object.keys(relevant).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return false;
    }
    return true;
  }

  function next() {
    if (validate(current)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    if (!available || !validate("review")) return;
    startTransition(async () => {
      const response = await submitQuoteAction(toPayload(getValues(), locale, idempotencyKey));
      setResult(response);
      if (!response.ok && response.fieldErrors) setErrors(response.fieldErrors);
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border bg-card p-6 md:p-8" role="status" aria-live="polite">
        <h2 className="flex items-center gap-2 text-2xl font-bold" tabIndex={-1} ref={headingRef}>
          <Check className="h-6 w-6 text-success" aria-hidden />
          {t("success.title")}
        </h2>
        <p className="mt-4 text-lg">{t("success.body", { reference: result.reference })}</p>
        <p className="mt-3 rounded-md bg-secondary px-4 py-3 font-mono text-xl font-semibold tracking-wider">{result.reference}</p>
        <p className="mt-4 text-muted-foreground">{t("success.next")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{result.emailSent ? t("success.emailSent") : t("success.emailNotSent")}</p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => {
            form.reset();
            setIdempotencyKey(crypto.randomUUID());
            setResult(null);
            setStep(0);
          }}
        >
          {t("success.another")}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ol className="mb-6 flex flex-wrap gap-2" aria-label={t("stepOf", { current: step + 1, total: STEPS.length })}>
        {STEPS.map((name, index) => (
          <li
            key={name}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              index === step ? "border-primary bg-primary text-primary-foreground" : index < step ? "border-primary/40 text-primary" : "text-muted-foreground",
            )}
          >
            <span className="sr-only">{t("stepOf", { current: index + 1, total: STEPS.length })}: </span>
            {t(`steps.${name}`)}
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (current === "review") submit();
          else next();
        }}
        noValidate
        className="rounded-xl border bg-card p-5 md:p-8"
      >
        {/* Honeypot: hidden from people and assistive technology. */}
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label>
            {t("honeypotLabel")}
            <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
          </label>
        </div>

        <p className="text-sm text-muted-foreground">{t("stepOf", { current: step + 1, total: STEPS.length })}</p>

        {current === "service" && (
          <fieldset>
            <legend>
              <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
                {t("serviceQuestion")}
              </h2>
            </legend>
            <p className="mt-1 text-sm text-muted-foreground">{t("serviceHint")}</p>
            <div role="radiogroup" aria-invalid={errors.service ? true : undefined} aria-describedby={errors.service ? "service-error" : undefined} className="mt-5 grid gap-3 sm:grid-cols-2">
              {SERVICE_CODES.map((code) => {
                return (
                  <label
                    key={code}
                    className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
                  >
                    <input type="radio" value={code} {...register("service")} className="mt-1 h-4 w-4" />
                    <span>
                      <span className="block font-medium">{ts(`${code}.title`)}</span>
                      <span className="block text-sm text-muted-foreground">{ts(`${code}.description`)}</span>
                      {!confirmedServices.includes(code) && <span className="mt-1 block text-xs font-medium text-warning">{th("availability")}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.service && (
              <p id="service-error" className="mt-2 text-sm font-medium text-destructive">
                {err("service")}
              </p>
            )}
          </fieldset>
        )}

        {current === "route" && (
          <fieldset className="space-y-5">
            <legend>
              <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
                {t("routeTitle")}
              </h2>
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="originCountry" label={t("originLabel")} error={err("originCountry")}>
                {(p) => (
                  <select {...p} {...register("originCountry")} className={selectClassName}>
                    {originCountries.map((c) => (
                      <option key={c} value={c}>
                        {countryName(c)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField id="destinationCountry" label={t("destinationLabel")} error={err("destinationCountry")}>
                {(p) => (
                  <select {...p} {...register("destinationCountry")} className={selectClassName}>
                    {destinationCountries.map((c) => (
                      <option key={c} value={c}>
                        {countryName(c)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            </div>
            <FormField id="destinationCity" label={t("cityLabel")} optionalLabel={tc("optional")} error={err("destinationCity")}>
              {(p) => <Input {...p} {...register("destinationCity")} maxLength={120} autoComplete="address-level2" className={inputClassName} />}
            </FormField>
          </fieldset>
        )}

        {current === "items" && (
          <fieldset className="space-y-6">
            <legend>
              <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
                {t("itemsTitle")}
              </h2>
            </legend>
            <p className="text-sm text-muted-foreground">{t("itemsHint")}</p>
            {errors.items && (
              <Alert variant="danger" id="items-error">
                {err("items")}
              </Alert>
            )}
            {fields.map((field, index) => (
              <fieldset key={field.id} className="space-y-4 rounded-lg border p-4">
                <legend className="px-1 text-sm font-semibold">{t("itemLabel", { number: index + 1 })}</legend>
                {service === "vehicle" ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField id={`items.${index}.vehicleMake`} label={t("vehicleMake")} error={err(`items.${index}.vehicleMake`)}>
                      {(p) => <Input {...p} {...register(`items.${index}.vehicleMake`)} maxLength={60} className={inputClassName} />}
                    </FormField>
                    <FormField id={`items.${index}.vehicleModel`} label={t("vehicleModel")} error={err(`items.${index}.vehicleModel`)}>
                      {(p) => <Input {...p} {...register(`items.${index}.vehicleModel`)} maxLength={60} className={inputClassName} />}
                    </FormField>
                    <FormField id={`items.${index}.vehicleYear`} label={t("vehicleYear")} error={err(`items.${index}.vehicleYear`)}>
                      {(p) => <Input {...p} {...register(`items.${index}.vehicleYear`)} inputMode="numeric" maxLength={4} className={inputClassName} />}
                    </FormField>
                    <label className="flex items-center gap-3 text-sm sm:col-span-3">
                      <input type="checkbox" {...register(`items.${index}.running`)} className="h-4 w-4" />
                      {t("vehicleRunning")}
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-6">
                    <FormField id={`items.${index}.description`} label={t("description")} error={err(`items.${index}.description`)} className="sm:col-span-4">
                      {(p) => <Input {...p} {...register(`items.${index}.description`)} maxLength={200} placeholder={t("descriptionPlaceholder")} className={inputClassName} />}
                    </FormField>
                    <FormField id={`items.${index}.quantity`} label={t("quantity")} error={err(`items.${index}.quantity`)} className="sm:col-span-2">
                      {(p) => <Input {...p} {...register(`items.${index}.quantity`)} inputMode="numeric" className={inputClassName} />}
                    </FormField>
                    <FormField id={`items.${index}.weightKg`} label={t("weight")} optionalLabel={tc("optional")} error={err(`items.${index}.weightKg`)} className="sm:col-span-6 md:col-span-3">
                      {(p) => <Input {...p} {...register(`items.${index}.weightKg`)} inputMode="decimal" className={inputClassName} />}
                    </FormField>
                    {(["lengthCm", "widthCm", "heightCm"] as const).map((dim) => (
                      <FormField
                        key={dim}
                        id={`items.${index}.${dim}`}
                        label={t(dim === "lengthCm" ? "length" : dim === "widthCm" ? "width" : "height")}
                        optionalLabel={tc("optional")}
                        error={err(`items.${index}.${dim}`)}
                        className="sm:col-span-2 md:col-span-1"
                      >
                        {(p) => <Input {...p} {...register(`items.${index}.${dim}`)} inputMode="decimal" className={inputClassName} />}
                      </FormField>
                    ))}
                  </div>
                )}
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                    {t("removeItem", { number: index + 1 })}
                  </Button>
                )}
              </fieldset>
            ))}
            {fields.length < (service === "vehicle" ? 5 : 20) && (
              <Button type="button" variant="outline" onClick={() => append({ ...EMPTY_ITEM })}>
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                {t("addItem")}
              </Button>
            )}
            <FormField id="notes" label={t("notes")} optionalLabel={tc("optional")} error={err("notes")}>
              {(p) => <Textarea {...p} {...register("notes")} rows={4} maxLength={2000} placeholder={t("notesPlaceholder")} />}
            </FormField>
          </fieldset>
        )}

        {current === "contact" && (
          <fieldset className="space-y-5">
            <legend>
              <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
                {t("contactTitle")}
              </h2>
            </legend>
            <FormField id="contact.name" label={t("name")} error={err("contact.name")}>
              {(p) => <Input {...p} {...register("contact.name")} autoComplete="name" maxLength={120} className={inputClassName} />}
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="contact.email" label={t("email")} error={err("contact.email")}>
                {(p) => <Input {...p} {...register("contact.email")} type="email" autoComplete="email" maxLength={254} className={inputClassName} />}
              </FormField>
              <FormField id="contact.phone" label={t("phone")} optionalLabel={tc("optional")} error={err("contact.phone")}>
                {(p) => <Input {...p} {...register("contact.phone")} type="tel" autoComplete="tel" maxLength={32} className={inputClassName} />}
              </FormField>
            </div>
          </fieldset>
        )}

        {current === "review" && (
          <ReviewStep values={getValues()} countryName={countryName} onEdit={(target) => setStep(STEPS.indexOf(target))} headingRef={headingRef} />
        )}

        {result && !result.ok && (
          <Alert variant="danger" className="mt-6">
            {t(`errors.${result.code}`)}
          </Alert>
        )}
        {!available && current === "review" && (
          <Alert variant="warning" className="mt-6">
            {t("errors.unavailable")}
          </Alert>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || pending} className={cn(step === 0 && "invisible")}>
            {tc("back")}
          </Button>
          {current === "review" ? (
            <Button type="submit" size="lg" disabled={!available || pending} aria-busy={pending}>
              {pending ? t("submitting") : t("submit")}
            </Button>
          ) : (
            <Button type="submit" size="lg">
              {tc("next")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function ReviewStep({
  values,
  countryName,
  onEdit,
  headingRef,
}: {
  values: FormValues;
  countryName: (code: string) => string;
  onEdit: (step: (typeof STEPS)[number]) => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const t = useTranslations("quoteForm");
  const ts = useTranslations("services");
  const tc = useTranslations("common");
  const row = (label: string, value: React.ReactNode, step: (typeof STEPS)[number]) => (
    <div className="flex flex-col gap-1 border-b py-3 sm:flex-row sm:items-start sm:justify-between">
      <dt className="text-sm text-muted-foreground sm:w-40">{label}</dt>
      <dd className="flex-1 font-medium">{value}</dd>
      <dd>
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onEdit(step)}>
          {tc("edit")}
          <span className="sr-only">: {label}</span>
        </Button>
      </dd>
    </div>
  );
  return (
    <section>
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
        {t("reviewTitle")}
      </h2>
      <Alert className="mt-4">{t("reviewHint")}</Alert>
      <dl className="mt-4">
        {values.service && row(t("steps.service"), ts(`${values.service}.title`), "service")}
        {row(
          t("steps.route"),
          `${countryName(values.originCountry)} → ${countryName(values.destinationCountry)}${values.destinationCity ? ` (${values.destinationCity})` : ""}`,
          "route",
        )}
        {row(
          t("steps.items"),
          <ul className="list-inside list-disc text-sm font-normal">
            {values.items.map((item, i) => (
              <li key={i}>
                {values.service === "vehicle" ? `${item.vehicleMake} ${item.vehicleModel} (${item.vehicleYear})` : `${item.quantity} × ${item.description}${item.weightKg ? `, ~${item.weightKg} kg` : ""}`}
              </li>
            ))}
          </ul>,
          "items",
        )}
        {row(t("steps.contact"), `${values.contact.name} · ${values.contact.email}${values.contact.phone ? ` · ${values.contact.phone}` : ""}`, "contact")}
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        {t("privacyNotice")}{" "}
        <Link href="/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("privacyLink")}
        </Link>
      </p>
    </section>
  );
}
