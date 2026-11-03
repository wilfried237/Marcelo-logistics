"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getDb } from "@/lib/db/client";
import { deliverQueuedEmailsSoon } from "@/lib/email/dispatch";
import { replyViaLink, respondViaLink } from "@/lib/services/cases";
import type { ActionState } from "@/components/app/action-form";

/*
 * Actions behind a signed quote link. The link signature is verified on every
 * call (never trusted from a previous page view); the request id, status and
 * prices all come from the database, never from the form.
 */

const localeOf = (fd: FormData) => z.enum(routing.locales).catch("en").parse(fd.get("locale"));

async function clientIdentifier(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown-client";
}

async function failure(locale: string, code: string, fieldErrors?: Record<string, string>): Promise<ActionState> {
  const t = await getTranslations({ locale, namespace: "quoteView" });
  const tv = await getTranslations({ locale, namespace: "validation" });
  const messages: Record<string, string> = {
    rate_limited: t("errors.rateLimited"),
    invalid_quote_transition: t("errors.notAvailable"),
    quote_not_valid: t("errors.expired"),
    not_found: t("errors.notFound"),
  };
  return {
    status: "error",
    message: messages[code] ?? (code === "invalid" ? tv("invalid") : t("errors.generic")),
    fieldErrors: fieldErrors ? Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, tv(v as "required")])) : undefined,
  };
}

export async function respondLinkAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const token = String(fd.get("token") ?? "");
  const decision = fd.get("decision");
  if (decision !== "accept" && decision !== "decline") return failure(locale, "invalid");
  const result = await respondViaLink(getDb(), token, decision === "accept", await clientIdentifier());
  if (!result.ok) return failure(locale, result.code);
  deliverQueuedEmailsSoon();
  revalidatePath(`/${locale}/quote/view/${token}`);
  const t = await getTranslations({ locale, namespace: "quoteView" });
  return { status: "ok", message: decision === "accept" ? t("accepted") : t("declined") };
}

export async function replyLinkAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const token = String(fd.get("token") ?? "");
  const result = await replyViaLink(getDb(), token, fd.get("body"), await clientIdentifier());
  if (!result.ok) return failure(locale, result.code, result.fieldErrors);
  deliverQueuedEmailsSoon();
  revalidatePath(`/${locale}/quote/view/${token}`);
  return { status: "ok", message: (await getTranslations({ locale, namespace: "quoteView" }))("replySent") };
}
