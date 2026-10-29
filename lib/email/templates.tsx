import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { NEEDS_OWNER } from "@/config/owner";
import { formatMoney } from "@/lib/domain/money";

export type EmailLocale = "en" | "fr";
const MESSAGES = { en, fr } as const;

export function emailTranslator(locale: EmailLocale) {
  return createTranslator({ locale, messages: MESSAGES[locale] });
}

/** Brand name for emails; falls back to the neutral tagline while unresolved (B-01). */
function brand(locale: EmailLocale) {
  const t = emailTranslator(locale);
  const name = t("brand.name");
  return name.includes(NEEDS_OWNER) ? t("brand.tagline") : name;
}

const styles = {
  body: { backgroundColor: "#f5f7fa", fontFamily: "Inter, Segoe UI, Helvetica, Arial, sans-serif", color: "#1c2433" },
  container: { backgroundColor: "#ffffff", margin: "24px auto", padding: "32px", maxWidth: "560px", borderRadius: "8px" },
  heading: { fontSize: "20px", margin: "0 0 16px" },
  text: { fontSize: "15px", lineHeight: "24px", margin: "0 0 12px" },
  button: { backgroundColor: "#24427a", color: "#ffffff", padding: "12px 20px", borderRadius: "6px", fontWeight: 600, textDecoration: "none" },
  footer: { fontSize: "12px", color: "#5b6577" },
};

function Layout({ locale, preview, children }: { locale: EmailLocale; preview: string; children: React.ReactNode }) {
  const t = emailTranslator(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {children}
          <Hr />
          <Text style={styles.text}>
            {t("emails.signoff")}
            <br />
            {t("emails.team")} · {brand(locale)}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function QuoteAcknowledgementEmail({ locale, name, reference }: { locale: EmailLocale; name: string; reference: string }) {
  const t = emailTranslator(locale);
  return (
    <Layout locale={locale} preview={t("emails.ack.subject", { reference })}>
      <Heading style={styles.heading}>{t("emails.ack.subject", { reference })}</Heading>
      <Text style={styles.text}>{t("emails.greeting", { name })}</Text>
      <Text style={styles.text}>{t("emails.ack.body", { reference })}</Text>
      <Text style={styles.text}>{t("emails.ack.next")}</Text>
    </Layout>
  );
}

export function QuoteIssuedEmail({
  locale,
  name,
  reference,
  amountMinor,
  currency,
  validUntil,
  url,
}: {
  locale: EmailLocale;
  name: string;
  reference: string;
  amountMinor: number;
  currency: string;
  validUntil: Date;
  url: string;
}) {
  const t = emailTranslator(locale);
  const date = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-IE", { dateStyle: "long", timeZone: "Europe/Dublin" }).format(validUntil);
  return (
    <Layout locale={locale} preview={t("emails.quote.subject", { reference })}>
      <Heading style={styles.heading}>{t("emails.quote.subject", { reference })}</Heading>
      <Text style={styles.text}>{t("emails.greeting", { name })}</Text>
      <Text style={styles.text}>{t("emails.quote.body", { reference })}</Text>
      <Text style={styles.text}>{t("emails.quote.amount", { amount: formatMoney(amountMinor, currency, locale) })}</Text>
      <Text style={styles.text}>{t("emails.quote.validUntil", { date })}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={url} style={styles.button}>
          {t("emails.quote.cta")}
        </Button>
      </Section>
    </Layout>
  );
}

export function ShipmentUpdateEmail({ locale, name, reference, milestone, url }: { locale: EmailLocale; name: string; reference: string; milestone: string; url: string }) {
  const t = emailTranslator(locale);
  const label = t(`milestones.${milestone}` as "milestones.BOOKED");
  return (
    <Layout locale={locale} preview={t("emails.shipment.subject", { reference })}>
      <Heading style={styles.heading}>{t("emails.shipment.subject", { reference })}</Heading>
      <Text style={styles.text}>{t("emails.greeting", { name })}</Text>
      <Text style={styles.text}>{t("emails.shipment.body", { reference, milestone: label })}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={url} style={styles.button}>
          {t("emails.shipment.cta")}
        </Button>
      </Section>
    </Layout>
  );
}

export function StaffNewRequestEmail({ reference, service, url }: { reference: string; service: string; url: string }) {
  const t = emailTranslator("en");
  return (
    <Layout locale="en" preview={t("emails.staffNew.subject", { reference })}>
      <Heading style={styles.heading}>{t("emails.staffNew.subject", { reference })}</Heading>
      <Text style={styles.text}>{t("emails.staffNew.body", { reference, service })}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={url} style={styles.button}>
          {reference}
        </Button>
      </Section>
    </Layout>
  );
}
