import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/config/env";

/** Only the approved production deployment may be indexed; previews and local builds never are. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/en/portal", "/fr/portal", "/en/admin", "/fr/admin"] },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
