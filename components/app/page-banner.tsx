/**
 * Title band for public content pages: ink background with the logo-blue arc,
 * matching the home page hero. Holds the page's single h1.
 */
export function PageBanner({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
      <svg viewBox="0 0 600 200" className="absolute -right-24 -top-6 -z-10 h-56 w-[36rem] opacity-60" aria-hidden focusable="false">
        <path d="M20 190 C 160 -40, 440 -40, 580 150" fill="none" stroke="var(--brand)" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" />
      </svg>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-lg text-ink-muted">{description}</p>}
        {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
      </div>
    </section>
  );
}
