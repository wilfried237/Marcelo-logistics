import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { ownerConfig } from "@/config/owner";
import { getSiteUrl } from "@/lib/config/env";
import { SERVICE_OFFERINGS } from "@/lib/domain/services";

/** Public, indexable pages in every locale. Terms are listed only once approved (L-01). */
const PAGES = ["", "/services", ...SERVICE_OFFERINGS.map((s) => `/services/${s.key}`), "/prices", "/how-it-works", "/shipping-guide", "/quote", "/track", "/about", "/faq", "/contact", "/privacy", "/cookies"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const pages = ownerConfig.legal.termsApproved ? [...PAGES, "/terms"] : PAGES;
  return pages.map((path) => ({
    url: `${base}/${routing.defaultLocale}${path}`,
    alternates: { languages: Object.fromEntries(routing.locales.map((locale) => [locale, `${base}/${locale}${path}`])) },
  }));
}
