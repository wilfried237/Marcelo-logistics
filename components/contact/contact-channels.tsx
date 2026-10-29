import { useTranslations } from "next-intl";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { verifiedContacts } from "@/config/owner";

/**
 * Shows only owner-verified contact channels (decision C-01). If none are
 * verified, an honest "being confirmed" message is shown instead.
 */
export function ContactChannels() {
  const t = useTranslations("contact");
  const c = verifiedContacts();
  const items = [
    c.irelandPhone && { icon: Phone, label: t("phoneIreland"), value: c.irelandPhone.value, href: `tel:${c.irelandPhone.value}` },
    c.cameroonPhone && { icon: Phone, label: t("phoneCameroon"), value: c.cameroonPhone.value, href: `tel:${c.cameroonPhone.value}` },
    c.irelandWhatsApp && {
      icon: MessageCircle,
      label: t("whatsapp"),
      value: c.irelandWhatsApp.value,
      href: `https://wa.me/${c.irelandWhatsApp.value.replace(/\D/g, "")}`,
    },
    c.email && { icon: Mail, label: t("email"), value: c.email.value, href: `mailto:${c.email.value}` },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href: string }[];

  if (items.length === 0) {
    return <p className="text-muted-foreground">{t("pending")}</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.href}>
          <a href={item.href} className="flex min-h-11 items-center gap-3 rounded-lg border bg-background px-4 py-3 hover:bg-secondary">
            <item.icon className="h-5 w-5 text-primary" aria-hidden />
            <span>
              <span className="block text-sm text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
