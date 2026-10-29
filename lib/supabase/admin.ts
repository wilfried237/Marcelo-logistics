import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabasePublicConfig } from "@/lib/config/env";

/**
 * Service-role client: BYPASSES RLS. Use only after application-level
 * authorisation (requireRole / ownership checks), for Storage and admin invites.
 * Never import from client components (enforced by scripts/check-security.mjs).
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicConfig();
  return createClient(url, getServiceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
