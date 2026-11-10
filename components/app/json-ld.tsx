import { headers } from "next/headers";

/**
 * Structured data (schema.org JSON-LD). Carries the per-request CSP nonce set by
 * proxy.ts, and escapes "<" so content can never close the script element.
 * Structured data does not make a page indexable: robots.ts still blocks
 * crawlers until the launch build (R-03).
 */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
