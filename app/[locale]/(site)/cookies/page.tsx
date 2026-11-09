import { getTranslations, setRequestLocale } from "next-intl/server";
import { ownerConfig } from "@/config/owner";
import { Alert } from "@/components/app/alert";
import { Container } from "@/components/app/page-header";
import { PageBanner } from "@/components/app/page-banner";
import { CONSENT_COOKIE } from "@/lib/consent/consent";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: "cookiePolicy" }))("title") };
}

/**
 * Factual cookie inventory, verified against the live site and the code
 * (next-intl locale cookie, Supabase session and PKCE verifier, consent record).
 * Any new cookie must be added here, in lib/consent/consent.ts and in
 * docs/legal before release. Legal wording approval: decision L-04.
 */
const COOKIES = [
  { name: "NEXT_LOCALE", key: "locale", provider: "firstParty" },
  { name: CONSENT_COOKIE, key: "consentCookie", provider: "firstParty" },
  { name: null, key: "session", provider: "firstPartySupabase" },
  { name: null, key: "verifier", provider: "firstPartySupabase" },
] as const;

export default async function CookiePolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("cookiePolicy");
  return (
    <>
      <PageBanner title={t("title")} />
      <Container size="narrow" className="py-10 md:py-14">
        {!ownerConfig.legal.cookiePolicyApproved && <Alert variant="warning">{t("draftNotice")}</Alert>}
        <p className="mt-8 text-muted-foreground">{t("intro")}</p>
        <div className="mt-8 space-y-8">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">{t("summaryTitle")}</h2>
            <p className="text-muted-foreground">{t("summary")}</p>
          </section>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">{t("tableTitle")}</h2>
            <ul className="space-y-4">
              {COOKIES.map((cookie) => (
                <li key={cookie.key} className="rounded-lg border p-4">
                  <h3 className="font-mono text-sm font-semibold break-all">{cookie.name ?? t(`${cookie.key}.name`)}</h3>
                  <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
                    <dt className="font-medium">{t("purpose")}</dt>
                    <dd className="text-muted-foreground">{t(`${cookie.key}.purpose`)}</dd>
                    <dt className="font-medium">{t("category")}</dt>
                    <dd className="text-muted-foreground">{t("necessary")}</dd>
                    <dt className="font-medium">{t("duration")}</dt>
                    <dd className="text-muted-foreground">{t(`${cookie.key}.duration`)}</dd>
                    <dt className="font-medium">{t("provider")}</dt>
                    <dd className="text-muted-foreground">{t(cookie.provider)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
          {(["optional", "manage", "questions"] as const).map((key) => (
            <section key={key} className="space-y-2">
              <h2 className="text-xl font-semibold">{t(`${key}Title`)}</h2>
              <p className="text-muted-foreground">{t(key)}</p>
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
