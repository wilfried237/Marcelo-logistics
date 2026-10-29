"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client using only the public URL and anon key (mapped in next.config.ts).
 * Authentication flows run server-side; this client is available for future
 * client-only features and never receives privileged keys.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase is not configured");
  return createBrowserClient(url, anonKey);
}
