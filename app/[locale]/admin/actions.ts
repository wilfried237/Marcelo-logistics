"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSiteUrl, isStorageConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin, isStaff, type AppUser } from "@/lib/auth/types";
import { USER_ROLES } from "@/lib/domain/enums";
import { dublinLocalToIso } from "@/lib/domain/time";
import type { ActionState } from "@/components/app/action-form";
import { notifyQuoteIssued, notifyShipmentUpdate } from "@/lib/email/notifications";
import { getQuoteRequestForStaff, sendQuote, transitionQuoteRequest, type StaffActionResult } from "@/lib/services/quote-requests";
import { addShipmentEvent, createShipmentForRequest, getShipmentForStaff, setShipmentEventVisibility, updateShipment } from "@/lib/services/shipments";
import { setUserRole } from "@/lib/services/users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const localeOf = (fd: FormData) => z.enum(routing.locales).catch("en").parse(fd.get("locale"));
const bool = (fd: FormData, name: string) => fd.get(name) === "on" || fd.get(name) === "true";

async function context(fd: FormData, requireAdmin = false) {
  const locale = localeOf(fd);
  const user = await getCurrentUser();
  const allowed = requireAdmin ? isAdmin(user) : isStaff(user);
  return { locale, user: allowed ? (user as AppUser) : null };
}

/** Translates a service result into an ActionState with localized messages. */
async function toState(locale: string, result: StaffActionResult<unknown>, okMessage: string): Promise<ActionState> {
  if (result.ok) return { status: "ok", message: okMessage };
  const tv = await getTranslations({ locale, namespace: "validation" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const fieldErrors = result.fieldErrors ? Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, tv(v as "required")])) : undefined;
  const known: Record<string, string> = {
    invalid_quote_transition: tc("notAllowed"),
    permission_denied: tc("notAllowed"),
    forbidden: tc("notAllowed"),
  };
  return { status: "error", message: known[result.code] ?? (result.code === "invalid" ? tv("invalid") : tc("genericError")), fieldErrors };
}

async function denied(locale: string): Promise<ActionState> {
  return { status: "error", message: (await getTranslations({ locale, namespace: "common" }))("notAllowed") };
}

export async function transitionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.quote" });
  const result = await transitionQuoteRequest(getDb(), user, { requestId: fd.get("requestId"), to: fd.get("to"), reason: fd.get("reason") || undefined });
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, t("applied"));
}

export async function sendQuoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.quote" });
  const db = getDb();
  const result = await sendQuote(db, user, {
    requestId: fd.get("requestId"),
    amount: fd.get("amount"),
    currency: fd.get("currency"),
    inclusions: fd.get("inclusions") ?? "",
    exclusions: fd.get("exclusions") ?? "",
    validUntil: fd.get("validUntil"),
  });
  if (!result.ok) return toState(locale, result, "");
  revalidatePath(`/${locale}/admin`, "layout");
  const data = result.data!;
  const request = await getQuoteRequestForStaff(db, user, data.reference);
  const quote = request?.quotes.find((q) => q.id === data.quoteId);
  let emailed = false;
  if (quote) {
    const outcome = await notifyQuoteIssued(db, {
      quoteId: data.quoteId,
      reference: data.reference,
      ...data.notify,
      amountMinor: quote.amountMinor,
      currency: quote.currency,
      validUntil: new Date(quote.validUntil),
    }).catch(() => "failed" as const);
    emailed = outcome === "sent" || outcome === "already_sent";
  }
  return { status: "ok", message: emailed ? t("sent") : t("sentNotEmailed") };
}

export async function createShipmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.quote" });
  const result = await createShipmentForRequest(getDb(), user, String(fd.get("requestId") ?? ""));
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, result.ok ? t("shipmentCreated", { reference: result.data!.reference }) : "");
}

export async function updateShipmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const tc = await getTranslations({ locale, namespace: "common" });
  const result = await updateShipment(getDb(), user, {
    shipmentId: fd.get("shipmentId"),
    status: fd.get("status"),
    etaFrom: fd.get("etaFrom") ?? "",
    etaTo: fd.get("etaTo") ?? "",
    etaVisible: bool(fd, "etaVisible"),
  });
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, tc("saved"));
}

export async function addEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.shipment" });
  const tv = await getTranslations({ locale, namespace: "validation" });
  const occurredAt = dublinLocalToIso(String(fd.get("occurredAt") ?? ""));
  if (!occurredAt) return { status: "error", message: tv("invalid"), fieldErrors: { occurredAt: tv("invalid") } };
  const db = getDb();
  const input = {
    shipmentId: fd.get("shipmentId"),
    milestone: fd.get("milestone"),
    location: fd.get("location") ?? "",
    occurredAt,
    noteEn: fd.get("noteEn") ?? "",
    noteFr: fd.get("noteFr") ?? "",
    public: bool(fd, "public"),
  };
  const result = await addShipmentEvent(db, user, input);
  if (result.ok && input.public) {
    const reference = String(fd.get("reference") ?? "");
    const shipment = await getShipmentForStaff(db, user, reference);
    if (shipment) {
      await notifyShipmentUpdate(db, {
        eventKey: `${shipment.id}:${String(input.milestone)}:${occurredAt}`,
        reference: shipment.reference,
        milestone: String(input.milestone),
        email: shipment.customerEmail,
        name: shipment.customerName,
        locale: shipment.customerLocale,
      }).catch(() => undefined);
    }
  }
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, t("recorded"));
}

export async function toggleEventVisibilityAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const tc = await getTranslations({ locale, namespace: "common" });
  const result = await setShipmentEventVisibility(getDb(), user, String(fd.get("eventId") ?? ""), fd.get("visible") === "true");
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, tc("saved"));
}

export async function setRoleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd, true);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.users" });
  const role = z.enum(USER_ROLES).safeParse(fd.get("role"));
  if (!role.success) return denied(locale);
  const result = await setUserRole(getDb(), user, String(fd.get("userId") ?? ""), role.data);
  revalidatePath(`/${locale}/admin/users`);
  if (!result.ok && result.code === "last_admin") return { status: "error", message: t("lastAdmin") };
  return toState(locale, result, (await getTranslations({ locale, namespace: "common" }))("saved"));
}

export async function inviteUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd, true);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.users" });
  if (!isStorageConfigured()) return { status: "error", message: t("inviteUnavailable") };
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().pipe(z.email()), role: z.enum(USER_ROLES), inviteLocale: z.enum(routing.locales) })
    .safeParse({ email: fd.get("email"), role: fd.get("role"), inviteLocale: fd.get("inviteLocale") ?? locale });
  if (!parsed.success) return { status: "error", message: (await getTranslations({ locale, namespace: "validation" }))("invalid_email") };
  const { data, error } = await createSupabaseAdminClient().auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/api/auth/callback?next=${encodeURIComponent(`/${parsed.data.inviteLocale}/reset-password`)}`,
    data: { locale: parsed.data.inviteLocale },
  });
  if (error || !data.user) return { status: "error", message: (await getTranslations({ locale, namespace: "common" }))("genericError") };
  if (parsed.data.role !== "customer") {
    const result = await setUserRole(getDb(), user, data.user.id, parsed.data.role);
    if (!result.ok) return toState(locale, result, "");
  }
  revalidatePath(`/${locale}/admin/users`);
  return { status: "ok", message: t("invited") };
}
