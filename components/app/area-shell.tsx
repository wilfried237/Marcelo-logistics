import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/app/[locale]/(auth)/actions";
import { AreaNav, type AreaNavItem } from "./area-nav";

/** Shell for signed-in areas: compact header, section navigation, single <main>. */
export async function AreaShell({
  locale,
  title,
  navLabel,
  items,
  userLabel,
  children,
}: {
  locale: string;
  title: string;
  navLabel: string;
  items: AreaNavItem[];
  userLabel: string | null;
  children: React.ReactNode;
}) {
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");
  return (
    <>
      <header className="border-b bg-background">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring">
          {tn("skipToContent")}
        </a>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3 font-semibold">
            <Logo className="h-10 w-auto shrink-0" />
            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{title}</span>
          </Link>
          <div className="flex items-center gap-3">
            {userLabel && <span className="hidden max-w-48 truncate text-sm text-muted-foreground md:inline">{userLabel}</span>}
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
                {tc("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 md:grid-cols-[13rem_1fr] md:px-6 md:py-10">
        <AreaNav items={items} label={navLabel} />
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}
