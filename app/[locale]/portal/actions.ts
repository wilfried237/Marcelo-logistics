"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { documentUploadsAvailable } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import type { ActionState } from "@/components/app/action-form";
import { respondToQuote } from "@/lib/services/quote-requests";
import { addCustomerReply, reportShipmentIssue } from "@/lib/services/cases";
import { deliverQueuedEmailsSoon } from "@/lib/email/dispatch";
import { updateOwnCustomerProfile } from "@/lib/services/users";
import { uploadDocument } from "@/lib/services/documents";
import { supabaseDocumentStorage } from "@/lib/storage/supabase-storage";

const locale = (formData: FormData) => z.enum(routing.locales).catch("en").parse(formData.get("locale"));

export async function respondToQuoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const l = locale(formData);
  const t = await getTranslations({ locale: l, namespace: "portal.quoteDetail" });
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: (await getTranslations({ locale: l, namespace: "common" }))("notAllowed") };
  const reference = String(formData.get("reference") ?? "");
  const accept = formData.get("decision") === "accept";
  const result = await respondToQuote(getDb(), user, reference, accept);
  if (!result.ok) return { status: "error", message: t("respondError") };
  deliverQueuedEmailsSoon();
  revalidatePath(`/${l}/portal`, "layout");
  return { status: "ok", message: accept ? t("accepted") : t("declined") };
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const l = locale(formData);
  const tc = await getTranslations({ locale: l, namespace: "common" });
  const tv = await getTranslations({ locale: l, namespace: "validation" });
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: tc("notAllowed") };
  const parsed = z
    .object({
      name: z.string().trim().min(1, "required").max(120, "too_long"),
      phone: z
        .string()
        .trim()
        .regex(/^(\+?[0-9 ()-]{5,32})?$/, "invalid_phone")
        .transform((v) => v || null),
      preferredLocale: z.enum(["en", "fr"]),
    })
    .safeParse({ name: formData.get("name"), phone: formData.get("phone") ?? "", preferredLocale: formData.get("preferredLocale") });
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), tv(i.message as "required")]));
    return { status: "error", message: tc("genericError"), fieldErrors };
  }
  const result = await updateOwnCustomerProfile(getDb(), user, parsed.data);
  if (!result.ok) return { status: "error", message: tc("genericError") };
  revalidatePath(`/${l}/portal/profile`);
  return { status: "ok", message: tc("saved") };
}

export async function uploadDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const l = locale(formData);
  const t = await getTranslations({ locale: l, namespace: "portal.documents" });
  const user = await getCurrentUser();
  if (!user || !documentUploadsAvailable()) return { status: "error", message: t("unavailable") };
  const target = String(formData.get("owner") ?? "");
  const [ownerType, ownerId] = target.split(":");
  const file = formData.get("file");
  if ((ownerType !== "quote_request" && ownerType !== "shipment") || !ownerId || !(file instanceof File)) {
    return { status: "error", message: t("errors.not_found") };
  }
  if (file.size > 10 * 1024 * 1024) return { status: "error", message: t("errors.too_large") };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadDocument(getDb(), supabaseDocumentStorage(), user, { ownerType, ownerId, fileName: file.name, bytes });
  if (!result.ok) return { status: "error", message: t(`errors.${result.code}`) };
  revalidatePath(`/${l}/portal/documents`);
  return { status: "ok", message: t("uploaded") };
}

async function messageResult(l: "en" | "fr", result: { ok: boolean; code?: string; fieldErrors?: Record<string, string> }, okKey: "replySent" | "issueSent"): Promise<ActionState> {
  const t = await getTranslations({ locale: l, namespace: "quoteView" });
  if (result.ok) {
    deliverQueuedEmailsSoon();
    revalidatePath(`/${l}/portal`, "layout");
    return { status: "ok", message: t(okKey) };
  }
  const tv = await getTranslations({ locale: l, namespace: "validation" });
  return {
    status: "error",
    message: result.code === "invalid" ? tv("invalid") : t("errors.generic"),
    fieldErrors: result.fieldErrors ? Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [k, tv(v as "required")])) : undefined,
  };
}

/** Reply on the customer's own request (identity from the session; ownership checked by RLS). */
export async function replyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const l = locale(formData);
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: (await getTranslations({ locale: l, namespace: "common" }))("notAllowed") };
  return messageResult(l, await addCustomerReply(getDb(), user, String(formData.get("reference") ?? ""), formData.get("body")), "replySent");
}

/** Reports a problem with the customer's own shipment; staff are alerted by email. */
export async function reportIssueAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const l = locale(formData);
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: (await getTranslations({ locale: l, namespace: "common" }))("notAllowed") };
  return messageResult(l, await reportShipmentIssue(getDb(), user, String(formData.get("reference") ?? ""), formData.get("body")), "issueSent");
}
