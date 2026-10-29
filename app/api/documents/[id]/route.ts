import { NextResponse, type NextRequest } from "next/server";
import { isStorageConfigured } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { documentDownloadUrl } from "@/lib/services/documents";
import { supabaseDocumentStorage } from "@/lib/storage/supabase-storage";

/**
 * Private document download: requires a session, checks visibility through
 * RLS, then redirects to a 60-second signed URL. Unknown, foreign and
 * malformed ids all return the same 404.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const notFound = NextResponse.json({ code: "NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isStorageConfigured()) return notFound;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const url = await documentDownloadUrl(getDb(), supabaseDocumentStorage(), user, id);
  if (!url) return notFound;
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
