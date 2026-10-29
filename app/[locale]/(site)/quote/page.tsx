"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ownerConfig } from "@/config/owner";

const TYPES = ["parcel", "container", "airExpress", "car", "freight"] as const;

export default function QuotePage() {
  const t = useTranslations("quote");
  const locale = useLocale();
  const countryName = (code: string) => new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  const [type, setType] = useState<(typeof TYPES)[number] | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/quote", { method: "POST", body: new FormData(event.currentTarget) });
      // No success path exists until database-backed submission is enabled.
      setError(response.status === 503 ? t("form.errors.unavailable") : t("form.errors.generic"));
    } catch {
      setError(t("form.errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <h1 className="text-4xl font-bold tracking-tight">{t("hero.title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("hero.subtitle")}</p>

      <div role="status" className="mt-8 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{t("unavailable.title")}</p>
          <p className="text-sm">{t("unavailable.body")}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-8" noValidate={false}>
        <fieldset>
          <legend className="text-lg font-semibold">{t("shipmentTypes.title")}</legend>
          <p className="text-sm text-muted-foreground">{t("shipmentTypes.description")}</p>
          <div role="radiogroup" className="mt-4 grid gap-3 sm:grid-cols-2">
            {TYPES.map((value) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:checked]:border-primary has-[:checked]:bg-secondary">
                <input type="radio" name="shipmentType" value={value} checked={type === value} onChange={() => setType(value)} required className="mt-1" />
                <span>
                  <span className="block font-medium">{t(`shipmentTypes.options.${value}.label`)}</span>
                  <span className="block text-sm text-muted-foreground">{t(`shipmentTypes.options.${value}.description`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">{t("form.title")}</legend>
          <div className="space-y-2">
            <Label htmlFor="origin">{t("form.fields.origin")}</Label>
            <select id="origin" name="origin" className="h-10 w-full rounded-md border bg-background px-3">
              {ownerConfig.operations.originCountries.map((c) => (
                <option key={c} value={c}>{countryName(c)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination">{t("form.fields.destination")}</Label>
            <select id="destination" name="destination" className="h-10 w-full rounded-md border bg-background px-3">
              {ownerConfig.operations.destinationCountries.map((c) => (
                <option key={c} value={c}>{countryName(c)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">{t("form.fields.weight")}</Label>
            <Input id="weight" name="weight" type="number" min={0} step="0.1" inputMode="decimal" placeholder={t("form.fields.weightPlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dimensions">{t("form.fields.dimensions")}</Label>
            <Input id="dimensions" name="dimensions" placeholder={t("form.fields.dimensionsPlaceholder")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">{t("form.fields.description")}</Label>
            <Textarea id="description" name="description" rows={3} maxLength={2000} placeholder={t("form.fields.descriptionPlaceholder")} />
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-lg font-semibold">{t("form.fields.contactInfo")}</legend>
          <div className="space-y-2">
            <Label htmlFor="name">{t("form.fields.fullName")}</Label>
            <Input id="name" name="name" autoComplete="name" required maxLength={120} placeholder={t("form.fields.fullNamePlaceholder")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("form.fields.email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder={t("form.fields.emailPlaceholder")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="phone">{t("form.fields.phone")}</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder={t("form.fields.phonePlaceholder")} />
          </div>
        </fieldset>

        {error && (
          <div role="alert" className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p>{error}</p>
          </div>
        )}

        <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting} className="w-full sm:w-auto">
          {submitting ? t("form.buttons.processing") : t("form.buttons.submit")}
        </Button>
      </form>
    </div>
  );
}
