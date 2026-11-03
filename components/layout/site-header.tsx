"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Menu } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";

type MenuLink = { href: string; label: string; description: string };

function useMenus() {
  const t = useTranslations();
  const send: MenuLink[] = [
    { href: "/quote", label: t("nav.quote"), description: t("header.sendQuoteDesc") },
    { href: "/services", label: t("nav.services"), description: t("header.sendServicesDesc") },
    { href: "/shipping-guide", label: t("nav2.guide"), description: t("header.sendGuideDesc") },
  ];
  const help: MenuLink[] = [
    { href: "/how-it-works", label: t("nav2.howItWorks"), description: t("header.helpHowDesc") },
    { href: "/faq", label: t("nav2.faq"), description: t("header.helpFaqDesc") },
    { href: "/contact", label: t("nav.contact"), description: t("header.helpContactDesc") },
  ];
  return { send, help };
}

function LocaleSwitch({ onNavigate, tone = "dark" }: { onNavigate?: () => void; tone?: "dark" | "light" }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const colours =
    tone === "dark"
      ? "text-ink-muted hover:text-ink-foreground aria-[current=true]:bg-ink-foreground/15 aria-[current=true]:text-ink-foreground"
      : "text-muted-foreground hover:text-foreground aria-[current=true]:bg-secondary aria-[current=true]:text-foreground";
  return (
    <nav aria-label={t("language")} className="flex items-center gap-1 text-sm">
      {routing.locales.map((code) => (
        <Link
          key={code}
          href={pathname}
          locale={code}
          onClick={onNavigate}
          aria-current={code === locale ? "true" : undefined}
          lang={code}
          className={`rounded px-2 py-1 font-semibold uppercase ${colours}`}
        >
          {code}
        </Link>
      ))}
    </nav>
  );
}

/** Desktop dropdown: a disclosure button with a panel of described links. */
function NavMenu({ label, links, active }: { label: string; links: MenuLink[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-[72px] items-center gap-1 border-b-[3px] px-3 text-[15px] font-semibold hover:text-primary ${active || open ? "border-brand text-foreground" : "border-transparent text-foreground/80"}`}
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <div id={id} hidden={!open} className="absolute left-0 top-full z-50 w-[22rem] border border-t-0 bg-background shadow-lg">
        <ul className="py-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} onClick={() => setOpen(false)} className="block px-5 py-3 hover:bg-secondary focus-visible:bg-secondary">
                <span className="block font-semibold text-foreground">{link.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{link.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TopLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-[72px] items-center border-b-[3px] px-3 text-[15px] font-semibold hover:text-primary ${active ? "border-brand text-foreground" : "border-transparent text-foreground/80"}`}
    >
      {children}
    </Link>
  );
}

export function SiteHeader({ showAccount = false }: { showAccount?: boolean }) {
  const t = useTranslations("nav");
  const t2 = useTranslations("nav2");
  const th = useTranslations("header");
  const pathname = usePathname();
  const { send, help } = useMenus();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const inGroup = (links: MenuLink[]) => links.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));

  return (
    <header className="sticky top-0 z-40 bg-background shadow-[0_1px_0_var(--border)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring">
        {t("skipToContent")}
      </a>

      {/* Utility bar */}
      <div className="bg-ink text-ink-foreground">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <p className="hidden text-sm text-ink-muted sm:block">{th("corridor")}</p>
          <nav aria-label={th("utilityNav")} className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/faq" className="hidden rounded px-2 py-1 text-ink-muted hover:text-ink-foreground md:block">
              {th("help")}
            </Link>
            <Link href="/contact" className="hidden rounded px-2 py-1 text-ink-muted hover:text-ink-foreground md:block">
              {t("contact")}
            </Link>
            {showAccount && (
              <Link href="/login" className="whitespace-nowrap rounded px-2 py-1 text-ink-muted hover:text-ink-foreground">
                {t2("account")}
              </Link>
            )}
            <span className="mx-1 hidden h-4 w-px bg-ink-foreground/25 md:block" aria-hidden />
          </nav>
          <LocaleSwitch />
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-4 md:px-6">
        <Link href="/" className="flex shrink-0 items-center rounded-sm">
          <Logo priority className="h-11 w-auto sm:h-[3.25rem]" />
        </Link>

        <nav aria-label={th("mainNav")} className="hidden h-full items-center lg:flex">
          <NavMenu label={th("send")} links={send} active={inGroup(send)} />
          <TopLink href="/track">{t("track")}</TopLink>
          <NavMenu label={th("help")} links={help} active={inGroup(help)} />
          <TopLink href="/about">{t2("about")}</TopLink>
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <Button asChild variant="outline">
            <Link href="/track">{t("track")}</Link>
          </Button>
          <Button asChild>
            <Link href="/quote">{t("quote")}</Link>
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <Button asChild size="sm" className="hidden whitespace-nowrap sm:inline-flex">
            <Link href="/quote">{t("quote")}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("openMenu")}>
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(22rem,100vw)] gap-0 overflow-y-auto">
              <SheetHeader className="border-b">
                <SheetTitle>
                  <Logo className="h-10 w-auto" />
                </SheetTitle>
              </SheetHeader>
              <div className="border-b p-4">
                <Button asChild className="w-full">
                  <Link href="/quote" onClick={close}>
                    {t("quote")}
                  </Link>
                </Button>
              </div>
              <nav aria-label={th("mainNav")} className="flex flex-col">
                <MobileGroup label={th("send")} links={send} onNavigate={close} />
                <Link href="/track" onClick={close} className="border-b px-4 py-4 font-semibold hover:bg-secondary">
                  {t("track")}
                </Link>
                <MobileGroup label={th("help")} links={help} onNavigate={close} />
                <Link href="/about" onClick={close} className="border-b px-4 py-4 font-semibold hover:bg-secondary">
                  {t2("about")}
                </Link>
                {showAccount && (
                  <Link href="/login" onClick={close} className="border-b px-4 py-4 font-semibold hover:bg-secondary">
                    {t2("account")}
                  </Link>
                )}
              </nav>
              <div className="p-4">
                <LocaleSwitch onNavigate={close} tone="light" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileGroup({ label, links, onNavigate }: { label: string; links: MenuLink[]; onNavigate: () => void }) {
  return (
    <details className="group border-b">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 font-semibold hover:bg-secondary [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="pb-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} onClick={onNavigate} className="block px-6 py-2.5 hover:bg-secondary">
              <span className="block font-medium">{link.label}</span>
              <span className="block text-sm text-muted-foreground">{link.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
