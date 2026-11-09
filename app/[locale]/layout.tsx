import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent/consent";
import { ConsentProvider } from "@/components/consent/consent-provider";
import { CookieConsent } from "@/components/consent/cookie-consent";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-inter" });

export const viewport: Viewport = { themeColor: "#1f3a68", colorScheme: "light" };

// Per-request rendering: required for the CSP nonce applied by proxy.ts.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Reading request headers makes every page render per request, which the CSP
  // nonce requires (proxy.ts). Next.js applies the nonce to its scripts.
  await headers();
  const messages = await getMessages();
  // Read on the server so a returning visitor never sees the banner flash.
  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);

  return (
    <html lang={locale} className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <NextIntlClientProvider messages={messages}>
          <ConsentProvider initial={consent}>
            {children}
            <CookieConsent />
          </ConsentProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
