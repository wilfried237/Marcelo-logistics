import { CURRENCY_EXPONENT, type Currency } from "./enums";

/*
 * Staff-entered quotation arithmetic. No floating point anywhere:
 * - amounts are integer minor units (BigInt);
 * - quantities are exact decimals with up to 3 places, held as thousandths (BigInt);
 * - rounding is half away from zero, identical to the database's
 *   app_quote_line_amount / app_quote_lines_total, which re-verify every total
 *   when a quote is sent.
 * There is no price list: every unit price is typed by staff (directive; P-03).
 */

export const LINE_KINDS = ["charge", "discount", "tax"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const MAX_LINES = 50;
export const MAX_QUANTITY_THOUSANDTHS = 100_000_000n; // 100 000.000
export const MAX_UNIT_MINOR = 999_999_999_999n; // < 10^12, same as the database
export const MAX_TOTAL_MINOR = 999_999_999_999n; // quotes.amount_minor < 10^12

export interface LineInput {
  kind: LineKind;
  description: string;
  /** Decimal string, e.g. "2", "1.5", "0.125" (charges and discounts). */
  quantity?: string;
  /** Major-unit decimal string typed by staff, e.g. "45.50" (EUR) or "25000" (XAF). */
  unitPrice?: string;
  /** Tax rate in basis points (2300 = 23 %); only rates approved in configuration. */
  rateBp?: number;
}

export interface PricedLine {
  position: number;
  kind: LineKind;
  description: string;
  quantityThousandths: bigint;
  unitAmountMinor: bigint;
  rateBp: number | null;
  lineTotalMinor: bigint;
}

export interface QuoteCalculation {
  currency: Currency;
  lines: PricedLine[];
  chargesMinor: bigint;
  discountsMinor: bigint; // negative or zero
  subtotalMinor: bigint; // charges + discounts (taxable base)
  taxMinor: bigint;
  totalMinor: bigint;
}

export type PricingError =
  | { code: "no_lines" }
  | { code: "too_many_lines" }
  | { code: "no_charge" }
  | { code: "invalid_quantity"; line: number }
  | { code: "invalid_amount"; line: number }
  | { code: "invalid_description"; line: number }
  | { code: "tax_not_allowed"; line: number }
  | { code: "subtotal_not_positive" }
  | { code: "total_too_large" };

/** Parses "1", "1.5", "0,125" into thousandths. Rejects negatives, zero, exponents and >3 decimals. */
export function parseQuantity(value: string): bigint | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const thousandths = BigInt(match[1]) * 1000n + BigInt((match[2] ?? "").padEnd(3, "0") || "0");
  if (thousandths <= 0n || thousandths > MAX_QUANTITY_THOUSANDTHS) return null;
  return thousandths;
}

/** Parses a major-unit amount into minor units for the currency. Zero is allowed (free items); negatives are not. */
export function parseAmount(value: string, currency: Currency): bigint | null {
  const exponent = CURRENCY_EXPONENT[currency];
  const match = /^(\d{1,12})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > exponent) return null; // e.g. XAF has no minor unit
  const minor = BigInt(match[1]) * 10n ** BigInt(exponent) + BigInt(fraction.padEnd(exponent, "0") || "0");
  return minor <= MAX_UNIT_MINOR ? minor : null;
}

/** a / b rounded half away from zero, for b > 0. */
function divRound(a: bigint, b: bigint): bigint {
  const negative = a < 0n;
  const abs = negative ? -a : a;
  const q = (abs * 2n + b) / (2n * b);
  return negative ? -q : q;
}

/** Amount of one charge or discount line: quantity x unit price, rounded to the minor unit. */
export function lineAmount(kind: "charge" | "discount", quantityThousandths: bigint, unitMinor: bigint): bigint {
  const amount = divRound(quantityThousandths * unitMinor, 1000n);
  return kind === "discount" ? -amount : amount;
}

/** Tax on a positive base at a rate in basis points, rounded to the minor unit. */
export function taxAmount(baseMinor: bigint, rateBp: number): bigint {
  return divRound(baseMinor * BigInt(rateBp), 10_000n);
}

/**
 * Prices a quotation. Charges and discounts form the subtotal; tax lines apply
 * to the subtotal and are accepted only for rates in `allowedTaxRatesBp`
 * (empty until VAT presentation is approved, P-03).
 */
export function calculateQuote(
  inputs: LineInput[],
  currency: Currency,
  allowedTaxRatesBp: readonly number[] = [],
): { ok: true; value: QuoteCalculation } | { ok: false; error: PricingError } {
  if (inputs.length === 0) return { ok: false, error: { code: "no_lines" } };
  if (inputs.length > MAX_LINES) return { ok: false, error: { code: "too_many_lines" } };

  const lines: PricedLine[] = [];
  const taxes: { index: number; input: LineInput }[] = [];
  for (const [index, input] of inputs.entries()) {
    const line = index + 1;
    const description = input.description.trim();
    if (description.length < 1 || description.length > 200) return { ok: false, error: { code: "invalid_description", line } };
    if (input.kind === "tax") {
      if (input.rateBp === undefined || !Number.isInteger(input.rateBp) || !allowedTaxRatesBp.includes(input.rateBp)) {
        return { ok: false, error: { code: "tax_not_allowed", line } };
      }
      taxes.push({ index, input });
      lines.push({ position: line, kind: "tax", description, quantityThousandths: 1000n, unitAmountMinor: 0n, rateBp: input.rateBp, lineTotalMinor: 0n });
      continue;
    }
    const quantity = parseQuantity(input.quantity ?? "1");
    if (quantity === null) return { ok: false, error: { code: "invalid_quantity", line } };
    const unit = parseAmount(input.unitPrice ?? "", currency);
    if (unit === null) return { ok: false, error: { code: "invalid_amount", line } };
    lines.push({ position: line, kind: input.kind, description, quantityThousandths: quantity, unitAmountMinor: unit, rateBp: null, lineTotalMinor: lineAmount(input.kind, quantity, unit) });
  }

  if (!lines.some((l) => l.kind === "charge")) return { ok: false, error: { code: "no_charge" } };
  const chargesMinor = lines.filter((l) => l.kind === "charge").reduce((sum, l) => sum + l.lineTotalMinor, 0n);
  const discountsMinor = lines.filter((l) => l.kind === "discount").reduce((sum, l) => sum + l.lineTotalMinor, 0n);
  const subtotalMinor = chargesMinor + discountsMinor;
  if (subtotalMinor <= 0n) return { ok: false, error: { code: "subtotal_not_positive" } };

  let taxMinor = 0n;
  for (const { index, input } of taxes) {
    const amount = taxAmount(subtotalMinor, input.rateBp!);
    lines[index] = { ...lines[index], lineTotalMinor: amount };
    taxMinor += amount;
  }
  const totalMinor = subtotalMinor + taxMinor;
  if (totalMinor > MAX_TOTAL_MINOR) return { ok: false, error: { code: "total_too_large" } };
  return { ok: true, value: { currency, lines, chargesMinor, discountsMinor, subtotalMinor, taxMinor, totalMinor } };
}

/** Formats minor units exactly (no float division), e.g. 123456n EUR -> "€1,234.56". */
export function formatMinor(amountMinor: bigint | number, currency: string, locale: string): string {
  const exponent = CURRENCY_EXPONENT[currency as Currency] ?? 2;
  const value = BigInt(amountMinor);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const scale = 10n ** BigInt(exponent);
  const decimal = `${negative ? "-" : ""}${abs / scale}${exponent ? "." + String(abs % scale).padStart(exponent, "0") : ""}`;
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(decimal as unknown as number); // Intl accepts exact decimal strings
}

/** Thousandths -> "1.5" for display and for the database decimal column. */
export function formatQuantity(thousandths: bigint): string {
  const whole = thousandths / 1000n;
  const fraction = String(thousandths % 1000n).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}
