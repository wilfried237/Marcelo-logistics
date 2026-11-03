import { useFormatter, useTranslations } from "next-intl";
import { formatMinor } from "@/lib/domain/pricing";

export interface BreakdownQuote {
  currency: string;
  amountMinor: number;
  validUntil: Date | string;
  inclusions: string;
  exclusions: string;
  lines: { position: number; kind: string; description: string; quantity: string; unitAmountMinor: number; rateBp: number | null; lineTotalMinor: number }[];
}

/**
 * Customer-facing quotation breakdown: what is charged, discounts, tax (when an
 * approved rate was used), total, validity, inclusions and exclusions. Shows only
 * the prices staff entered for the customer; there is no internal cost data.
 */
export function QuoteBreakdown({ quote, locale }: { quote: BreakdownQuote; locale: string }) {
  const t = useTranslations("quoteView.breakdown");
  const format = useFormatter();
  const money = (v: number) => formatMinor(v, quote.currency, locale);
  const lines = quote.lines.length
    ? quote.lines
    : [{ position: 1, kind: "charge", description: t("single"), quantity: "1", unitAmountMinor: quote.amountMinor, rateBp: null, lineTotalMinor: quote.amountMinor }];
  const tax = lines.filter((l) => l.kind === "tax").reduce((s, l) => s + l.lineTotalMinor, 0);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border bg-card">
        <table className="w-full min-w-[30rem] text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead className="border-b bg-secondary/60 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("description")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("quantity")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("unitPrice")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines
              .filter((l) => l.kind !== "tax")
              .map((l) => (
                <tr key={l.position} className="border-b">
                  <td className="px-3 py-2">{l.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(l.kind === "discount" ? -l.unitAmountMinor : l.unitAmountMinor)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(l.lineTotalMinor)}</td>
                </tr>
              ))}
            <tr className="border-b">
              <th scope="row" colSpan={3} className="px-3 py-2 text-right font-normal text-muted-foreground">
                {t("subtotal")}
              </th>
              <td className="px-3 py-2 text-right tabular-nums">{money(quote.amountMinor - tax)}</td>
            </tr>
            {tax > 0 && (
              <tr className="border-b">
                <th scope="row" colSpan={3} className="px-3 py-2 text-right font-normal text-muted-foreground">
                  {t("tax")}
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{money(tax)}</td>
              </tr>
            )}
            <tr>
              <th scope="row" colSpan={3} className="px-3 py-3 text-right text-base font-semibold">
                {t("total")}
              </th>
              <td className="px-3 py-3 text-right text-base font-semibold tabular-nums">{money(quote.amountMinor)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm">{t("validUntil", { date: format.dateTime(new Date(quote.validUntil), { dateStyle: "long", timeZone: "Europe/Dublin" }) })}</p>
      {quote.inclusions && (
        <p className="text-sm">
          <span className="font-semibold">{t("includes")}:</span> {quote.inclusions}
        </p>
      )}
      {quote.exclusions && (
        <p className="text-sm">
          <span className="font-semibold">{t("excludes")}:</span> {quote.exclusions}
        </p>
      )}
    </div>
  );
}
