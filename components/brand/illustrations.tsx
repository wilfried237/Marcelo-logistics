import { cn } from "@/lib/utils";

/*
 * Original brand mark drawn for this site (the official logo stays hidden until
 * the owner approves it, A-01). Colours come from the logo palette tokens.
 */

/** Small arc-and-arrow mark used next to the business name: a route over the sea. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={cn("h-8 w-10", className)} aria-hidden focusable="false">
      <path d="M4 27 L11 9 L16 21 L21 9 L26 27" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M17 12 C 22 1, 33 1, 36 13" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
      <path d="M32.5 11.5 L36 13.5 L37.5 9.5" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
