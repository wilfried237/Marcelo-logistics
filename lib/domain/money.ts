import { CURRENCY_EXPONENT, type Currency } from "./enums";

/** Converts a staff-typed major-unit string ("450.5") to integer minor units without floating point. */
export function toMinorUnits(amount: string, currency: Currency): number | null {
  const normalised = amount.trim().replace(",", ".");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(normalised);
  if (!match) return null;
  const exponent = CURRENCY_EXPONENT[currency];
  const fraction = match[2] ?? "";
  if (fraction.length > exponent && /[1-9]/.test(fraction.slice(exponent))) return null; // e.g. XAF has no decimals
  const minor = Number(match[1]) * 10 ** exponent + Number((fraction + "00").slice(0, exponent) || "0");
  return minor > 0 ? minor : null;
}

export function formatMoney(amountMinor: number, currency: string, locale: string): string {
  const exponent = CURRENCY_EXPONENT[currency as Currency] ?? 2;
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amountMinor / 10 ** exponent);
}
