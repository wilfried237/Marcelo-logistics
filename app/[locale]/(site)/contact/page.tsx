import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ContactChannels } from "@/components/contact/contact-channels";
import { PageBanner } from "@/components/app/page-banner";
import { ContactForm } from "@/components/contact/contact-form";
import { Illustration } from "@/components/brand/illustration";
import { isDatabaseConfigured } from "@/lib/config/env";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title") };
}

export default function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("contact");
  const tf = useTranslations("contactForm");
  const ti = useTranslations("illustrations");
  return (
    <>
      <PageBanner title={t("title")} description={t("description")} />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[3fr_2fr]">
        {isDatabaseConfigured() ? (
          <section aria-labelledby="form-heading">
            <h2 id="form-heading" className="mb-6 text-2xl font-bold tracking-tight">
              {tf("title")}
            </h2>
            <ContactForm />
          </section>
        ) : null}
        <section aria-labelledby="channels-heading">
          <h2 id="channels-heading" className="mb-6 text-2xl font-bold tracking-tight">
            {tf("channels")}
          </h2>
          <ContactChannels />
          <Illustration name="supportChat" alt={ti("supportChat")} className="mt-10 max-w-sm" />
        </section>
      </div>
    </>
  );
}
