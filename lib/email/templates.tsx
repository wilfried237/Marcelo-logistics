import { Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

/*
 * Transactional email layout. Table-based components from React Email, inline
 * styles only (limited-CSS clients), one column, max 600 px. Colours are the
 * logo's ink and blue. The footer carries no phone or email address until they
 * are verified (C-01); customers are pointed to the website's contact page.
 */

export type EmailLocale = "en" | "fr";
const MESSAGES = { en, fr } as const;

export function emailTranslator(locale: EmailLocale) {
  return createTranslator({ locale, messages: MESSAGES[locale] });
}

const C = { ink: "#0e1726", blue: "#0796da", button: "#0b6fb3", text: "#1c2433", muted: "#5b6577", line: "#e3e8ef", bg: "#f3f5f8" };

const s = {
  body: { backgroundColor: C.bg, fontFamily: "Inter, 'Segoe UI', Helvetica, Arial, sans-serif", color: C.text, margin: 0, padding: "24px 0" },
  container: { backgroundColor: "#ffffff", maxWidth: "600px", margin: "0 auto", borderTop: `4px solid ${C.blue}` },
  header: { padding: "24px 32px 8px" },
  content: { padding: "8px 32px 24px" },
  heading: { fontSize: "22px", lineHeight: "30px", fontWeight: 700, color: C.ink, margin: "8px 0 16px" },
  text: { fontSize: "15px", lineHeight: "24px", margin: "0 0 14px", color: C.text },
  muted: { fontSize: "13px", lineHeight: "20px", margin: "0 0 8px", color: C.muted },
  factLabel: { fontSize: "13px", color: C.muted, margin: 0, padding: "6px 0" },
  factValue: { fontSize: "14px", fontWeight: 600, color: C.ink, margin: 0, padding: "6px 0", textAlign: "right" as const },
  button: { backgroundColor: C.button, color: "#ffffff", padding: "12px 22px", borderRadius: "4px", fontWeight: 600, fontSize: "15px", textDecoration: "none" },
  footer: { backgroundColor: C.ink, padding: "20px 32px" },
  footerText: { fontSize: "12px", lineHeight: "18px", color: "#c5ccd8", margin: "0 0 6px" },
  footerLink: { color: "#ffffff", textDecoration: "underline" },
  callout: { borderLeft: `4px solid ${C.blue}`, backgroundColor: "#f0f7fc", padding: "12px 16px", margin: "0 0 16px" },
  cell: { fontSize: "13px", padding: "8px 6px", borderBottom: `1px solid ${C.line}`, color: C.text },
  cellRight: { fontSize: "13px", padding: "8px 6px", borderBottom: `1px solid ${C.line}`, color: C.text, textAlign: "right" as const, whiteSpace: "nowrap" as const },
  head: { fontSize: "12px", padding: "6px", color: C.muted, textAlign: "left" as const, borderBottom: `2px solid ${C.line}` },
};

export interface Fact {
  label: string;
  value: string;
}

export interface BreakdownLine {
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export interface Breakdown {
  title: string;
  labels: { description: string; quantity: string; unitPrice: string; amount: string; subtotal: string; tax: string; total: string; includes: string; excludes: string };
  lines: BreakdownLine[];
  subtotal: string;
  tax: string | null;
  total: string;
  inclusions: string;
  exclusions: string;
}

export interface TransactionalEmailProps {
  locale: EmailLocale;
  siteUrl: string;
  preview: string;
  heading: string;
  greeting?: string;
  paragraphs: string[];
  /** Quoted text shown in a highlighted block (e.g. staff's information request). */
  callout?: string;
  facts?: Fact[];
  breakdown?: Breakdown;
  cta?: { label: string; href: string };
  /** Internal staff alert: different footer, no greeting or sign-off. */
  internal?: boolean;
  actionRequired?: string;
}

export function TransactionalEmail(props: TransactionalEmailProps) {
  const { locale, siteUrl, preview, heading, greeting, paragraphs, callout, facts, breakdown, cta, internal, actionRequired } = props;
  const t = emailTranslator(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Section style={s.header}>
            <Img src={`${siteUrl}/brand/marchelo-logo-email.png`} width="150" height="81" alt="Marchelo Logistics" />
          </Section>
          <Section style={s.content}>
            <Heading as="h1" style={s.heading}>
              {heading}
            </Heading>
            {greeting && <Text style={s.text}>{greeting}</Text>}
            {paragraphs.map((p, i) => (
              <Text key={i} style={s.text}>
                {p}
              </Text>
            ))}
            {callout && (
              <Section style={s.callout}>
                <Text style={{ ...s.text, margin: 0, whiteSpace: "pre-line" }}>{callout}</Text>
              </Section>
            )}
            {actionRequired && (
              <Section style={s.callout}>
                <Text style={{ ...s.text, margin: 0 }}>
                  <strong>{t("emails.staff.common.actionRequired")}:</strong> {actionRequired}
                </Text>
              </Section>
            )}
            {facts && facts.length > 0 && (
              <Section style={{ margin: "4px 0 18px", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
                {facts.map((f) => (
                  <Row key={f.label}>
                    <Column style={s.factLabel}>{f.label}</Column>
                    <Column style={s.factValue}>{f.value}</Column>
                  </Row>
                ))}
              </Section>
            )}
            {breakdown && <BreakdownTable breakdown={breakdown} />}
            {cta && (
              <Section style={{ margin: "8px 0 20px" }}>
                <Button href={cta.href} style={s.button}>
                  {cta.label}
                </Button>
              </Section>
            )}
            {!internal && (
              <>
                <Hr style={{ borderColor: C.line, margin: "20px 0 12px" }} />
                <Text style={s.text}>
                  {t("emails.common.signoff")}
                  <br />
                  {t("emails.common.team")}
                </Text>
              </>
            )}
          </Section>
          <Section style={s.footer}>
            <Text style={{ ...s.footerText, color: "#ffffff", fontWeight: 600 }}>Marchelo Logistics · {t("emails.common.tagline")}</Text>
            <Text style={s.footerText}>{internal ? t("emails.staff.common.footer") : t("emails.common.automated")}</Text>
            {!internal && (
              <Text style={s.footerText}>
                <Link href={`${siteUrl}/${locale}/contact`} style={s.footerLink}>
                  {siteUrl.replace(/^https?:\/\//, "")}/{locale}/contact
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function BreakdownTable({ breakdown: b }: { breakdown: Breakdown }) {
  return (
    <Section style={{ margin: "4px 0 20px" }}>
      <Text style={{ ...s.text, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>{b.title}</Text>
      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={s.head}>{b.labels.description}</th>
            <th style={{ ...s.head, textAlign: "right" }}>{b.labels.quantity}</th>
            <th style={{ ...s.head, textAlign: "right" }}>{b.labels.unitPrice}</th>
            <th style={{ ...s.head, textAlign: "right" }}>{b.labels.amount}</th>
          </tr>
        </thead>
        <tbody>
          {b.lines.map((l, i) => (
            <tr key={i}>
              <td style={s.cell}>{l.description}</td>
              <td style={s.cellRight}>{l.quantity}</td>
              <td style={s.cellRight}>{l.unitPrice}</td>
              <td style={s.cellRight}>{l.amount}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={{ ...s.cellRight, color: C.muted }}>
              {b.labels.subtotal}
            </td>
            <td style={s.cellRight}>{b.subtotal}</td>
          </tr>
          {b.tax && (
            <tr>
              <td colSpan={3} style={{ ...s.cellRight, color: C.muted }}>
                {b.labels.tax}
              </td>
              <td style={s.cellRight}>{b.tax}</td>
            </tr>
          )}
          <tr>
            <td colSpan={3} style={{ ...s.cellRight, fontWeight: 700, color: C.ink, borderBottom: "none" }}>
              {b.labels.total}
            </td>
            <td style={{ ...s.cellRight, fontWeight: 700, color: C.ink, fontSize: "15px", borderBottom: "none" }}>{b.total}</td>
          </tr>
        </tbody>
      </table>
      {b.inclusions && (
        <Text style={{ ...s.muted, marginTop: "12px" }}>
          <strong>{b.labels.includes}:</strong> {b.inclusions}
        </Text>
      )}
      {b.exclusions && (
        <Text style={s.muted}>
          <strong>{b.labels.excludes}:</strong> {b.exclusions}
        </Text>
      )}
    </Section>
  );
}

/**
 * Plain-text version built from the same content (not converted from HTML), so
 * text-only clients get readable labels, aligned amounts and full links.
 */
export function plainTextEmail(props: TransactionalEmailProps): string {
  const t = emailTranslator(props.locale);
  const out: string[] = ["Marchelo Logistics", "", props.heading.toUpperCase(), ""];
  if (props.greeting) out.push(props.greeting, "");
  for (const p of props.paragraphs) out.push(p, "");
  if (props.callout) out.push(...props.callout.split("\n").map((l) => `> ${l}`), "");
  if (props.actionRequired) out.push(`${t("emails.staff.common.actionRequired")}: ${props.actionRequired}`, "");
  if (props.facts?.length) {
    for (const f of props.facts) out.push(`${f.label}: ${f.value}`);
    out.push("");
  }
  const b = props.breakdown;
  if (b) {
    out.push(b.title);
    for (const l of b.lines) out.push(`- ${l.description}: ${l.quantity} x ${l.unitPrice} = ${l.amount}`);
    out.push(`${b.labels.subtotal}: ${b.subtotal}`);
    if (b.tax) out.push(`${b.labels.tax}: ${b.tax}`);
    out.push(`${b.labels.total}: ${b.total}`);
    if (b.inclusions) out.push(`${b.labels.includes}: ${b.inclusions}`);
    if (b.exclusions) out.push(`${b.labels.excludes}: ${b.exclusions}`);
    out.push("");
  }
  if (props.cta) out.push(`${props.cta.label}: ${props.cta.href}`, "");
  if (!props.internal) out.push(t("emails.common.signoff"), t("emails.common.team"), "");
  out.push("--", `Marchelo Logistics · ${t("emails.common.tagline")}`, props.internal ? t("emails.staff.common.footer") : t("emails.common.automated"));
  if (!props.internal) out.push(`${props.siteUrl}/${props.locale}/contact`);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
