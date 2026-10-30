"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/config/env";
import { isEnabled } from "@/lib/config/flags";
import { getDb } from "@/lib/db/client";
import { safeNextPath } from "@/lib/auth/redirects";
import { isAccountSystemAvailable } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAppUser } from "@/lib/services/users";
import { authAttemptAllowed, type AuthAttempt } from "@/lib/services/auth-limits";

/** Persistent per-client and per-email limits (fail closed), on top of Supabase's own limits. */
async function allowed(attempt: AuthAttempt, email: string): Promise<boolean> {
  const h = await headers();
  const clientId = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown-client";
  return authAttemptAllowed(getDb(), attempt, clientId, email);
}

export type AuthFormState = { status: "idle" } | { status: "error"; code: string; fieldErrors?: Record<string, string> } | { status: "sent" } | { status: "done" };

const localeSchema = z.enum(routing.locales);
const emailSchema = z.string().trim().toLowerCase().max(254, "too_long").pipe(z.email("invalid_email"));
const passwordSchema = z.string().min(12, "password_too_short").max(128, "too_long");

function firstErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= /^[a-z_]+$/.test(issue.message) ? issue.message : "invalid";
  return out;
}

/** Maps Supabase auth errors to non-enumerating codes. */
function authErrorCode(error: { status?: number; code?: string } | null): string {
  if (!error) return "generic";
  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") return "rate_limited";
  if (error.code === "weak_password") return "weak_password";
  return "generic";
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeSchema.catch("en").parse(formData.get("locale"));
  if (!isAccountSystemAvailable()) return { status: "error", code: "generic" };
  const parsed = z.object({ email: emailSchema, password: z.string().min(1, "required").max(128) }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { status: "error", code: "invalid_credentials", fieldErrors: firstErrors(parsed.error) };
  if (!(await allowed("login", parsed.data.email))) return { status: "error", code: "rate_limited" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { status: "error", code: error?.status === 429 ? "rate_limited" : "invalid_credentials" };

  const user = await loadAppUser(getDb(), data.user.id, data.user.email ?? null);
  const fallback = user && (user.role === "staff" || user.role === "admin") ? "/admin" : "/portal";
  redirect(safeNextPath(formData.get("next"), locale, fallback));
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeSchema.catch("en").parse(formData.get("locale"));
  // Registration is closed unless explicitly enabled (owner decision C-03).
  if (!isEnabled("ENABLE_CUSTOMER_REGISTRATION") || !isAccountSystemAvailable()) return { status: "error", code: "generic" };
  const parsed = z
    .object({
      fullName: z.string().trim().min(1, "required").max(120, "too_long"),
      email: emailSchema,
      password: passwordSchema,
      consent: z.literal("on", { error: "consent_required" }),
    })
    .safeParse({ fullName: formData.get("fullName"), email: formData.get("email"), password: formData.get("password"), consent: formData.get("consent") });
  if (!parsed.success) return { status: "error", code: "validation", fieldErrors: firstErrors(parsed.error) };
  if (!(await allowed("register", parsed.data.email))) return { status: "error", code: "rate_limited" };

  const supabase = await createSupabaseServerClient();
  // The role is never taken from the form: new users always start as customers
  // (database trigger app_handle_new_user).
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/api/auth/callback?next=${encodeURIComponent(`/${locale}/portal`)}`,
      data: { full_name: parsed.data.fullName, locale },
    },
  });
  if (error && authErrorCode(error) !== "generic") return { status: "error", code: authErrorCode(error) };
  // Same response whether or not the address already has an account.
  return { status: "sent" };
}

export async function forgotPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = localeSchema.catch("en").parse(formData.get("locale"));
  if (!isAccountSystemAvailable()) return { status: "error", code: "generic" };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", code: "validation", fieldErrors: { email: "invalid_email" } };
  // Limited requests get the same "check your email" answer, so the limit reveals nothing about the address.
  if (!(await allowed("reset", parsed.data))) return { status: "sent" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getSiteUrl()}/api/auth/callback?next=${encodeURIComponent(`/${locale}/reset-password`)}`,
  });
  if (error && authErrorCode(error) === "rate_limited") return { status: "error", code: "rate_limited" };
  return { status: "sent" };
}

export async function resetPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isAccountSystemAvailable()) return { status: "error", code: "generic" };
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "password_mismatch", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { status: "error", code: "validation", fieldErrors: firstErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "error", code: "session_required" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", code: authErrorCode(error) };
  return { status: "done" };
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = localeSchema.catch("en").parse(formData.get("locale"));
  if (isAccountSystemAvailable()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect(`/${locale}`);
}
