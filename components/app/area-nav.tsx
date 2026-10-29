"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface AreaNavItem {
  href: string;
  label: string;
}

/** Section navigation for the portal and staff areas (scrollable on small screens). */
export function AreaNav({ items, label }: { items: AreaNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {items.map((item) => {
          const active = item.href === pathname || (item.href !== items[0].href && pathname.startsWith(`${item.href}/`)) || (item.href !== items[0].href && pathname === item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
                  active && "bg-secondary text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
