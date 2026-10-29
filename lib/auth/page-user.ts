import "server-only";
import { requireRole, requireUser } from "./session";
import type { UserRole } from "@/lib/domain/enums";

/**
 * Pages re-check access themselves instead of relying only on their layout,
 * because layouts are not re-run on every client navigation.
 */
export function pageUser(locale: string, path: string) {
  return requireUser(locale, `/${locale}${path}`);
}

export function pageStaff(locale: string, path: string, roles: readonly UserRole[] = ["staff", "admin"]) {
  return requireRole(roles, locale, `/${locale}${path}`);
}
