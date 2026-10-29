import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./lib/security/headers";

const headers = securityHeaders({
  development: process.env.NODE_ENV === "development",
  // Vercel always serves HTTPS. Local `next start` is plain HTTP, where HSTS and
  // upgrade-insecure-requests would break the site.
  https: process.env.VERCEL === "1",
  supabaseUrl: process.env.SUPABASE_URL || undefined,
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Only PUBLIC values are mapped for the browser. The anon key is designed to be
  // public; the service-role key and database URLs must never appear here.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
  },
  async headers() {
    return [{ source: "/:path*", headers }];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
