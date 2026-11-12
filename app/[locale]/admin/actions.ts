"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { documentUploadsAvailable, getSiteUrl, isStorageConfigured } from "@/lib/config/env";
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_MEGABYTES } from "@/lib/config/upload-limits";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin, isStaff, type AppUser } from "@/lib/auth/types";
import { USER_ROLES } from "@/lib/domain/enums";
import { dublinLocalToIso } from "@/lib/domain/time";
import type { ActionState } from "@/components/app/action-form";
import { deliverQueuedEmailsSoon } from "@/lib/email/dispatch";
import { issueQuote, transitionQuoteRequest, type StaffActionResult } from "@/lib/services/quote-requests";
import { addInternalNote, assignRequest, requestInformation, setContactStatus } from "@/lib/services/cases";
import { addShipmentEvent, createShipmentForRequest, setShipmentEventVisibility, updateShipment } from "@/lib/services/shipments";
import { setUserRole } from "@/lib/services/users";
import { uploadDocument } from "@/lib/services/documents";
import { supabaseDocumentStorage } from "@/lib/storage/supabase-storage";
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
  if (result.ok) {
    deliverQueuedEmailsSoon();
    return { status: "ok", message: okMessage };
  }
  const tv = await getTranslations({ locale, namespace: "validation" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const tsh = await getTranslations({ locale, namespace: "admin.shipment" });
  const fieldErrors = result.fieldErrors ? Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, tv(v as "required")])) : undefined;
  const known: Record<string, string> = {
    invalid_quote_transition: tc("notAllowed"),
    invalid_shipment_transition: tsh("invalidTransition"),
    shipment_exists: tsh("alreadyExists"),
    delivered_milestone_exists: tsh("deliveredMilestoneExists"),
    quote_not_accepted: tsh("notAccepted"),
    quote_total_mismatch: tc("genericError"),
    assignee_not_staff: tc("notAllowed"),
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

/**
 * Issues a line-item quotation. Lines arrive as JSON from the calculator; the
 * server recomputes every amount (the browser preview is never trusted) and the
 * database verifies the totals again when the quote is sent.
 */
export async function issueQuoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.quote" });
  let lines: unknown;
  try {
    lines = JSON.parse(String(fd.get("lines") ?? "[]"));
  } catch {
    lines = [];
  }
  const result = await issueQuote(getDb(), user, {
    requestId: fd.get("requestId"),
    currency: fd.get("currency"),
    lines,
    inclusions: fd.get("inclusions") ?? "",
    exclusions: fd.get("exclusions") ?? "",
    validUntil: fd.get("validUntil"),
  });
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, t("sent"));
}

export async function addNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.case" });
  const result = await addInternalNote(getDb(), user, { requestId: fd.get("requestId"), body: fd.get("body"), shipmentId: fd.get("shipmentId") ?? undefined });
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, t("noteAdded"));
}

export async function requestInfoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.case" });
  const result = await requestInformation(getDb(), user, { requestId: fd.get("requestId"), body: fd.get("body") });
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, t("infoRequested"));
}

export async function assignAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const tc = await getTranslations({ locale, namespace: "common" });
  const result = await assignRequest(getDb(), user, { requestId: fd.get("requestId"), assigneeId: fd.get("assigneeId") });
  revalidatePath(`/${locale}/admin`, "layout");
  return toState(locale, result, tc("saved"));
}

export async function contactStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const tc = await getTranslations({ locale, namespace: "common" });
  const result = await setContactStatus(getDb(), user, fd.get("id"), fd.get("status"));
  revalidatePath(`/${locale}/admin/enquiries`);
  return toState(locale, result, tc("saved"));
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
    recordMilestone: bool(fd, "recordMilestone"),
    milestonePublic: bool(fd, "milestonePublic"),
  });
  revalidatePath(`/${locale}/admin`, "layout");
  const tsh = await getTranslations({ locale, namespace: "admin.shipment" });
  const milestone = result.ok ? result.data?.milestone : undefined;
  const message =
    milestone === "recorded"
      ? tsh("savedWithMilestone")
      : milestone === "published"
        ? tsh("savedMilestonePublished")
        : milestone === "skipped"
          ? tsh("savedMilestoneExists")
          : tc("saved");
  return toState(locale, result, message);
}

export async function addEventAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "admin.shipment" });
  const tv = await getTranslations({ locale, namespace: "validation" });
  const occurredAt = dublinLocalToIso(String(fd.get("occurredAt") ?? ""));
  if (!occurredAt) return { status: "error", message: tv("invalid"), fieldErrors: { occurredAt: tv("invalid") } };
  const input = {
    shipmentId: fd.get("shipmentId"),
    milestone: fd.get("milestone"),
    location: fd.get("location") ?? "",
    occurredAt,
    noteEn: fd.get("noteEn") ?? "",
    noteFr: fd.get("noteFr") ?? "",
    public: bool(fd, "public"),
  };
  const result = await addShipmentEvent(getDb(), user, input);
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

/**
 * Staff document upload (Stage 6, D2). Behind the same switch as customer
 * uploads (ENABLE_DOCUMENT_UPLOADS, off in production until L-03): the server
 * refuses it when uploads are unavailable, whatever the form shows. The
 * document service re-checks type, size and that the record exists.
 */
export async function staffUploadDocumentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { locale, user } = await context(fd);
  if (!user) return denied(locale);
  const t = await getTranslations({ locale, namespace: "portal.documents" });
  if (!documentUploadsAvailable()) return { status: "error", message: t("unavailable") };
  const ownerType = fd.get("ownerType");
  const ownerId = String(fd.get("ownerId") ?? "");
  const file = fd.get("file");
  if ((ownerType !== "quote_request" && ownerType !== "shipment") || !(file instanceof File)) return { status: "error", message: t("errors.generic") };
  const max = { max: MAX_DOCUMENT_MEGABYTES };
  if (file.size === 0) return { status: "error", message: t("errors.empty") };
  if (file.size > MAX_DOCUMENT_BYTES) return { status: "error", message: t("errors.too_large", max) };
  const result = await uploadDocument(getDb(), supabaseDocumentStorage(), user, { ownerType, ownerId, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (!result.ok) return { status: "error", message: t(`errors.${result.code === "not_found" ? "generic" : result.code}`, max) };
  revalidatePath(`/${locale}/admin`, "layout");
  return { status: "ok", message: t("uploaded") };
}
