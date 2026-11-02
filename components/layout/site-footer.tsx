import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandName } from "./brand-name";

function Column({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-foreground">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-ink-muted hover:text-ink-foreground hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 md:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="text-lg font-bold">
            <BrandName />
          </p>
          <p className="max-w-xs text-sm text-ink-muted">{t("header.corridor")}</p>
          <p className="max-w-xs text-sm text-ink-muted">{t("footer.pendingDetails")}</p>
        </div>
        <Column
          title={t("footer.send")}
          links={[
            { href: "/quote", label: t("nav.quote") },
            { href: "/services", label: t("nav.services") },
            { href: "/shipping-guide", label: t("nav2.guide") },
            { href: "/track", label: t("nav.track") },
          ]}
        />
        <Column
          title={t("footer.help")}
          links={[
            { href: "/how-it-works", label: t("nav2.howItWorks") },
            { href: "/faq", label: t("nav2.faq") },
            { href: "/contact", label: t("nav.contact") },
          ]}
        />
        <Column
          title={t("footer.company")}
          links={[
            { href: "/about", label: t("nav2.about") },
            { href: "/privacy", label: t("nav2.privacy") },
          ]}
        />
      </div>
      <div className="border-t border-ink-foreground/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-muted md:px-6">
          © {new Date().getFullYear()} <BrandName />. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
