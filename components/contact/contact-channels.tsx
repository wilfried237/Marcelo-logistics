import { useTranslations } from "next-intl";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ownerConfig, verifiedContacts } from "@/config/owner";
import { cn } from "@/lib/utils";

type Location = (typeof ownerConfig.locations)[keyof typeof ownerConfig.locations];

/**
 * The business's two locations (Ireland and Cameroon), WhatsApp, email and
 * opening hours, exactly as confirmed by the owner (C-01). Only verified channels
 * are shown; phone numbers use tel: links, WhatsApp the international wa.me link
 * (digits only, no +), and the email a mailto: link.
 *
 * `tone="dark"` is for the footer (light text on the ink background).
 */
export function ContactChannels({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const t = useTranslations("contact");
  const c = verifiedContacts();
  const locations = Object.values(ownerConfig.locations) as Location[];
  const muted = tone === "dark" ? "text-ink-muted" : "text-muted-foreground";
  const link = cn("font-medium underline-offset-4 hover:underline", tone === "dark" ? "text-ink-foreground" : "text-foreground");

  if (!c.irelandPhone && !c.cameroonPhone && !c.email) {
    return <p className={muted}>{t("pending")}</p>;
  }

  return (
    <div className={cn("space-y-6", className)}>
      <ul className={cn("grid gap-6", tone === "light" && "sm:grid-cols-2")}>
        {locations.map((location) => {
          const phone = c[location.phone];
          const whatsapp = c[location.whatsapp];
          const place = t(location.country === "IE" ? "ireland" : "cameroon");
          return (
            <li key={location.country} className={cn(tone === "light" && "border-l-2 border-brand pl-4")}>
              <h3 className={cn("font-semibold", tone === "dark" && "text-sm uppercase tracking-wider")}>{t(location.country === "IE" ? "ireland" : "cameroon")}</h3>
              <p className={cn("mt-1 flex items-start gap-2 text-sm", muted)}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="sr-only">{t(location.kind === "office" ? "officeLabel" : "locationLabel")} </span>
                  {location.place}
                </span>
              </p>
              {phone && (
                <p className="mt-1 flex items-center gap-2 text-sm">
                  <Phone className={cn("h-4 w-4 shrink-0", muted)} aria-hidden />
                  <a href={`tel:${phone.value}`} className={link} aria-label={t("callLabel", { place: t(location.country === "IE" ? "ireland" : "cameroon"), number: phone.display ?? phone.value })}>
                    {phone.display ?? phone.value}
                  </a>
                </p>
              )}
              {whatsapp && (
                <p className="mt-1 flex items-center gap-2 text-sm">
                  <MessageCircle className={cn("h-4 w-4 shrink-0", muted)} aria-hidden />
                  <span className={muted}>{t("whatsapp")}</span>
                  <a
                    href={`https://wa.me/${whatsapp.value.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={link}
                    aria-label={t("whatsappLabel", { place, number: whatsapp.display ?? whatsapp.value })}
                  >
                    {whatsapp.display ?? whatsapp.value}
                  </a>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {c.email && (
        <p className="flex items-center gap-2 text-sm">
          <Mail className={cn("h-4 w-4 shrink-0", muted)} aria-hidden />
          <span className={muted}>{t("emailLabel")}</span>
          <a href={`mailto:${c.email.value}`} className={cn(link, "break-all")}>
            {c.email.value}
          </a>
        </p>
      )}
      {ownerConfig.hours.open24x7 && (
        <p className="flex items-center gap-2 text-sm">
          <Clock className={cn("h-4 w-4 shrink-0", muted)} aria-hidden />
          <span className={muted}>{t("hoursLabel")}</span>
          <span className={tone === "dark" ? "text-ink-foreground" : "text-foreground"}>{t("hours24x7")}</span>
        </p>
      )}
      {/* 24/7 is business availability (phone, WhatsApp, email), not staffed premises: handover times are agreed per shipment. */}
      {ownerConfig.hours.open24x7 && <p className={cn("text-xs", muted)}>{t("hoursHandover")}</p>}
    </div>
  );
}
