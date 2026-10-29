import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAppUser } from "@/lib/services/users";
import { AuthorizationError, type AppUser } from "./types";
import type { UserRole } from "@/lib/domain/enums";

export function isAccountSystemAvailable(): boolean {
  return isAuthConfigured() && isDatabaseConfigured();
}

/**
 * The verified current user, or null. Uses supabase.auth.getUser(), which
 * validates the token with Supabase (never trusts the cookie payload alone).
 * The role is read from public.profiles, never from the token or the client.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  if (!isAccountSystemAvailable()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return await loadAppUser(getDb(), data.user.id, data.user.email ?? null);
  } catch (error) {
    console.error("session lookup failed", error instanceof Error ? error.name : "unknown");
    return null;
  }
});

export async function requireUser(locale: string, nextPath: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) return redirect({ href: { pathname: "/login", query: { next: nextPath } }, locale });
  return user;
}

/** Signed-in user with one of the roles; others get a 404 (no hint that the area exists). */
export async function requireRole(roles: readonly UserRole[], locale: string, nextPath: string): Promise<AppUser> {
  const user = await requireUser(locale, nextPath);
  if (!roles.includes(user.role)) notFound();
  return user;
}

/** Throws unless the user owns the customer record (staff may act on any). */
export function requireOwnership(user: AppUser, customerId: string): void {
  if (user.role === "staff" || user.role === "admin") return;
  if (!user.customerId || user.customerId !== customerId) throw new AuthorizationError("not_owner");
}
