import { Locale, routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import "./globals.css";
import {Navbar1}  from "@/components/navbar1";
import WhatsAppFloat from "@/components/float_Whatsapp";

export const metadata: Metadata = {
  title: "Marchelo Logistics",
  description: "Your trusted partner for global logistics.",
  icons: "/LOGO.png",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  
  if (!routing.locales.includes(locale)) {
    notFound();
  }
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Navbar1/>
          {children}
          <WhatsAppFloat/>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}