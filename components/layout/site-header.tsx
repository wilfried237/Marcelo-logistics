"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Menu, PackageSearch } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandName } from "./brand-name";

const NAV = [
  { key: "services", href: { pathname: "/services" } },
  { key: "track", href: { pathname: "/track" } },
  { key: "contact", href: { pathname: "/contact" } },
] as const;

function LocaleSwitch({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
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
          className="rounded-md px-2.5 py-2 font-medium uppercase text-muted-foreground hover:text-foreground aria-[current=true]:bg-secondary aria-[current=true]:text-foreground"
        >
          {code}
        </Link>
      ))}
    </nav>
  );
}

export function SiteHeader({ showAccount = false }: { showAccount?: boolean }) {
  const t = useTranslations("nav");
  const t2 = useTranslations("nav2");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring">
        {t("skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
          <PackageSearch className="h-6 w-6 shrink-0 text-primary" aria-hidden />
          <BrandName className="truncate" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link key={item.key} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
                {t(item.key)}
              </Link>
            ))}
          </nav>
          <LocaleSwitch />
          {showAccount && (
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
              {t2("account")}
            </Link>
          )}
          <Button asChild size="sm" className="ml-2">
            <Link href="/quote">{t("quote")}</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button asChild size="sm">
            <Link href="/quote">{t("quote")}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("openMenu")}>
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,100vw)]">
              <SheetHeader>
                <SheetTitle>
                  <BrandName />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Main" className="flex flex-col gap-1 px-4">
                <Link href="/" onClick={close} className="rounded-md px-3 py-3 font-medium hover:bg-secondary">
                  {t("home")}
                </Link>
                {NAV.map((item) => (
                  <Link key={item.key} href={item.href} onClick={close} className="rounded-md px-3 py-3 font-medium hover:bg-secondary">
                    {t(item.key)}
                  </Link>
                ))}
                <Link href="/quote" onClick={close} className="rounded-md px-3 py-3 font-medium hover:bg-secondary">
                  {t("quote")}
                </Link>
                {showAccount && (
                  <Link href="/login" onClick={close} className="rounded-md px-3 py-3 font-medium hover:bg-secondary">
                    {t2("account")}
                  </Link>
                )}
              </nav>
              <div className="px-4 pt-2">
                <LocaleSwitch onNavigate={close} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
