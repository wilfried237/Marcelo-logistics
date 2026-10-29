import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DocumentStorage } from "@/lib/services/documents";

export const DOCUMENT_BUCKET = "customer-documents";

/**
 * Private Supabase Storage bucket accessed with the service role, ONLY after
 * the caller passed application and RLS ownership checks. Clients never get
 * direct bucket access; downloads use 60-second signed URLs.
 */
export function supabaseDocumentStorage(): DocumentStorage {
  const bucket = () => createSupabaseAdminClient().storage.from(DOCUMENT_BUCKET);
  return {
    async upload(key, bytes, contentType) {
      const { error } = await bucket().upload(key, bytes, { contentType, upsert: false });
      if (error) throw new Error("storage upload failed");
    },
    async remove(key) {
      await bucket().remove([key]);
    },
    async signedUrl(key, expiresInSeconds) {
      const { data, error } = await bucket().createSignedUrl(key, expiresInSeconds, { download: true });
      if (error || !data) throw new Error("signed url failed");
      return data.signedUrl;
    },
  };
}
