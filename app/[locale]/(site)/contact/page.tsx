import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ContactChannels } from "@/components/contact/contact-channels";
import { PageBanner } from "@/components/app/page-banner";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title") };
}

export default function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("contact");
  return (
    <>
      <PageBanner title={t("title")} description={t("description")} />
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <ContactChannels />
      </div>
    </>
  );
}
