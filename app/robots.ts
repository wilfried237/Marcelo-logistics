import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/config/env";

/**
 * Only the approved launch build (RELEASE_BUILD=true, owner decision R-03) may be
 * indexed. Previews, local builds and the pre-launch Vercel production URL never are.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.RELEASE_BUILD !== "true") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/en/portal", "/fr/portal", "/en/admin", "/fr/admin"] },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
