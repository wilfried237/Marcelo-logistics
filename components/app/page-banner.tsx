import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Title band for public content pages: breadcrumb, the page's single h1 and an
 * introduction, on a light band with a logo-blue rule. Same structure on every
 * content page so the site reads as one system.
 */
export function PageBanner({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  const t = useTranslations();
  return (
    <section className="border-b bg-secondary">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-10 md:px-6 md:pb-14">
        <nav aria-label={t("breadcrumb.label")}>
          <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
                {t("nav.home")}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-medium text-foreground">
              {title}
            </li>
          </ol>
        </nav>
        <div className="mt-6 border-l-4 border-brand pl-5">
          <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-foreground md:text-5xl">{title}</h1>
          {description && <p className="mt-4 max-w-3xl text-lg text-muted-foreground">{description}</p>}
        </div>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
