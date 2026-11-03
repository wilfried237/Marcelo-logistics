import { describe, expect, it } from "vitest";
import { calculateQuote, formatMinor, formatQuantity, lineAmount, parseAmount, parseQuantity, taxAmount, MAX_LINES } from "@/lib/domain/pricing";

describe("parsing staff input without floating point", () => {
  it("parses quantities with up to three decimals", () => {
    expect(parseQuantity("2")).toBe(2000n);
    expect(parseQuantity("1.5")).toBe(1500n);
    expect(parseQuantity("0,125")).toBe(125n);
    for (const bad of ["0", "-1", "1.2345", "1e3", "", "abc", "100000.001", " 1 2"]) expect(parseQuantity(bad), bad).toBeNull();
  });

  it("parses amounts with the currency's minor unit", () => {
    expect(parseAmount("45.50", "EUR")).toBe(4550n);
    expect(parseAmount("45,5", "EUR")).toBe(4550n);
    expect(parseAmount("0", "EUR")).toBe(0n); // zero-value items are permitted
    expect(parseAmount("25000", "XAF")).toBe(25000n);
    expect(parseAmount("25000.5", "XAF")).toBeNull(); // XAF has no minor unit
    for (const bad of ["-1", "1.234", "1e5", "", "€5"]) expect(parseAmount(bad, "EUR"), bad).toBeNull();
    expect(parseAmount("9999999999.99", "EUR")).toBe(999_999_999_999n);
    expect(parseAmount("10000000000", "EUR")).toBeNull(); // overflow boundary (>= 10^12 minor)
  });
});

describe("line arithmetic", () => {
  it("multiplies quantity by unit price and rounds half away from zero", () => {
    expect(lineAmount("charge", 2000n, 4550n)).toBe(9100n);
    expect(lineAmount("charge", 1500n, 333n)).toBe(500n); // 499.5 -> 500
    expect(lineAmount("charge", 1000n, 0n)).toBe(0n);
    expect(lineAmount("discount", 1500n, 333n)).toBe(-500n);
    expect(lineAmount("charge", 125n, 1n)).toBe(0n); // 0.125 -> 0
  });

  it("computes tax on a base in basis points", () => {
    expect(taxAmount(10000n, 2300)).toBe(2300n);
    expect(taxAmount(1n, 5000)).toBe(1n); // 0.5 -> 1
    expect(taxAmount(12345n, 1350)).toBe(1667n); // 1666.575 -> 1667
  });
});

describe("quotation calculation", () => {
  const line = (kind: "charge" | "discount", quantity: string, unitPrice: string, description = "Item") => ({ kind, description, quantity, unitPrice });

  it("adds multiple lines, applies discounts and reports every intermediate amount", () => {
    const result = calculateQuote([line("charge", "2", "150.00", "Barrel"), line("charge", "1", "35.50", "Collection"), line("discount", "1", "20.00", "Loyalty")], "EUR");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ chargesMinor: 33550n, discountsMinor: -2000n, subtotalMinor: 31550n, taxMinor: 0n, totalMinor: 31550n });
    expect(result.value.lines.map((l) => l.lineTotalMinor)).toEqual([30000n, 3550n, -2000n]);
    expect(result.value.lines.map((l) => l.position)).toEqual([1, 2, 3]);
  });

  it("is reproducible: same input, same output", () => {
    const input = [line("charge", "3.333", "12.34"), line("discount", "1", "0.99")];
    expect(calculateQuote(input, "EUR")).toEqual(calculateQuote(input, "EUR"));
  });

  it("allows tax lines only for approved rates", () => {
    const withTax = [line("charge", "1", "100"), { kind: "tax" as const, description: "VAT", rateBp: 2300 }];
    expect(calculateQuote(withTax, "EUR")).toEqual({ ok: false, error: { code: "tax_not_allowed", line: 2 } });
    const approved = calculateQuote(withTax, "EUR", [2300]);
    expect(approved.ok && approved.value).toMatchObject({ subtotalMinor: 10000n, taxMinor: 2300n, totalMinor: 12300n });
  });

  it("rejects invalid quotations", () => {
    expect(calculateQuote([], "EUR")).toEqual({ ok: false, error: { code: "no_lines" } });
    expect(calculateQuote([line("discount", "1", "5")], "EUR")).toEqual({ ok: false, error: { code: "no_charge" } });
    expect(calculateQuote([line("charge", "1", "5"), line("discount", "1", "5")], "EUR")).toEqual({ ok: false, error: { code: "subtotal_not_positive" } });
    expect(calculateQuote([line("charge", "1", "0")], "EUR")).toEqual({ ok: false, error: { code: "subtotal_not_positive" } });
    expect(calculateQuote([line("charge", "-1", "5")], "EUR")).toEqual({ ok: false, error: { code: "invalid_quantity", line: 1 } });
    expect(calculateQuote([line("charge", "1", "-5")], "EUR")).toEqual({ ok: false, error: { code: "invalid_amount", line: 1 } });
    expect(calculateQuote([line("charge", "1", "5", " ")], "EUR")).toEqual({ ok: false, error: { code: "invalid_description", line: 1 } });
    expect(calculateQuote(Array.from({ length: MAX_LINES + 1 }, () => line("charge", "1", "1")), "EUR")).toEqual({ ok: false, error: { code: "too_many_lines" } });
    expect(calculateQuote([line("charge", "100000", "9999999999.99")], "EUR")).toEqual({ ok: false, error: { code: "total_too_large" } });
  });

  it("keeps the currency's precision (XAF has no minor unit)", () => {
    const result = calculateQuote([line("charge", "1.5", "25001")], "XAF");
    expect(result.ok && result.value.totalMinor).toBe(37502n); // 37501.5 -> 37502
  });
});

describe("display", () => {
  it("formats minor units exactly in both locales", () => {
    expect(formatMinor(123456n, "EUR", "en")).toBe("€1,234.56");
    expect(formatMinor(123456n, "EUR", "fr").replace(/\s/g, " ")).toBe("1 234,56 €");
    expect(formatMinor(999_999_999_999n, "EUR", "en")).toBe("€9,999,999,999.99");
    expect(formatMinor(-2000n, "EUR", "en")).toBe("-€20.00");
    expect(formatMinor(25000n, "XAF", "en")).toMatch(/25,000/);
  });

  it("formats quantities without trailing zeros", () => {
    expect(formatQuantity(1500n)).toBe("1.5");
    expect(formatQuantity(2000n)).toBe("2");
    expect(formatQuantity(125n)).toBe("0.125");
  });
});
