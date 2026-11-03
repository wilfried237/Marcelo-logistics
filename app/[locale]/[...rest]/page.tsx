import { notFound } from "next/navigation";

/**
 * Any unknown path under a locale renders the localised, branded not-found page
 * (app/[locale]/not-found.tsx) instead of Next.js's bare default 404.
 */
export default function CatchAll() {
  notFound();
}
