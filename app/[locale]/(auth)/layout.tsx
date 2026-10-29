import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Authentication pages: public site chrome, never indexed. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 bg-secondary/40">
        <div className="mx-auto w-full max-w-md px-4 py-12 md:py-16">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
