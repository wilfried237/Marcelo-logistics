import { cn } from "@/lib/utils";

/*
 * Original illustrations drawn for this site (no stock artwork). Colours come
 * from the design tokens, which follow the logo palette: ink and logo blue.
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

/** Ireland -> Cameroon arc with a container ship on stylised waves. */
export function RouteIllustration({ label, from, to, className }: { label: string; from: string; to: string; className?: string }) {
  return (
    <svg viewBox="0 0 480 300" role="img" aria-label={label} className={cn("h-auto w-full", className)}>
      <rect width="480" height="300" rx="20" fill="var(--ink)" />
      {/* faint latitude lines */}
      {[60, 110, 160, 210].map((y) => (
        <line key={y} x1="24" x2="456" y1={y} y2={y} stroke="var(--ink-muted)" strokeOpacity="0.12" />
      ))}
      {/* route arc */}
      <path id="route" d="M96 86 C 210 10, 360 70, 372 204" fill="none" stroke="var(--brand)" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
      <path d="M362 192 L372 206 L382 191" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* origin and destination */}
      <circle cx="96" cy="86" r="16" fill="var(--brand)" fillOpacity="0.18" />
      <circle cx="96" cy="86" r="7" fill="var(--brand)" />
      <circle cx="372" cy="222" r="16" fill="var(--brand)" fillOpacity="0.18" />
      <circle cx="372" cy="222" r="7" fill="var(--ink-foreground)" />
      <text x="96" y="56" textAnchor="middle" fill="var(--ink-foreground)" fontSize="18" fontWeight="600">
        {from}
      </text>
      <text x="372" y="262" textAnchor="middle" fill="var(--ink-foreground)" fontSize="18" fontWeight="600">
        {to}
      </text>
      {/* ship */}
      <g transform="translate(150 196)">
        <rect x="18" y="-26" width="22" height="14" rx="2" fill="var(--brand)" />
        <rect x="42" y="-26" width="22" height="14" rx="2" fill="var(--ink-foreground)" fillOpacity="0.85" />
        <rect x="66" y="-26" width="22" height="14" rx="2" fill="var(--brand)" fillOpacity="0.7" />
        <rect x="90" y="-40" width="14" height="28" rx="2" fill="var(--ink-foreground)" />
        <path d="M0 -12 H124 L112 8 H12 Z" fill="var(--ink-foreground)" />
      </g>
      {/* waves */}
      {[226, 246].map((y, i) => (
        <path
          key={y}
          d={`M${24 + i * 20} ${y} q 15 -8 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0`}
          fill="none"
          stroke="var(--brand)"
          strokeOpacity={0.5 - i * 0.2}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/** A sealed barrel and stacked taped boxes, for the packing guide. */
export function PackingIllustration({ label, className }: { label: string; className?: string }) {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label={label} className={cn("h-auto w-full", className)}>
      <rect width="320" height="240" rx="20" fill="var(--brand-soft)" />
      <ellipse cx="160" cy="206" rx="130" ry="10" fill="var(--ink)" fillOpacity="0.08" />
      {/* barrel */}
      <g transform="translate(46 54)">
        <path d="M6 10 Q0 76 6 146 H86 Q92 76 86 10 Z" fill="var(--primary)" />
        <ellipse cx="46" cy="10" rx="40" ry="10" fill="var(--brand)" />
        <rect x="2" y="4" width="88" height="10" rx="5" fill="var(--ink)" />
        <path d="M3 56 H89 M3 104 H89" stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="4" />
        <rect x="22" y="68" width="48" height="26" rx="3" fill="var(--ink-foreground)" />
        <path d="M30 77 H62 M30 85 H52" stroke="var(--ink)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* boxes */}
      <g transform="translate(160 92)">
        <rect x="0" y="40" width="72" height="68" rx="3" fill="#c99a62" />
        <rect x="76" y="56" width="62" height="52" rx="3" fill="#b9874f" />
        <rect x="14" y="-12" width="62" height="52" rx="3" fill="#d5a970" />
        <path d="M36 40 V108 M107 56 V108 M45 -12 V40" stroke="var(--brand)" strokeWidth="6" />
        <rect x="8" y="78" width="28" height="18" rx="2" fill="var(--ink-foreground)" />
        <path d="M13 85 H31 M13 90 H25" stroke="var(--ink)" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
