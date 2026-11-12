import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/lib/auth/types";

/*
 * Stage 6 (D2): the staff upload Server Action, with its collaborators mocked.
 * It must refuse when uploads are switched off (ENABLE_DOCUMENT_UPLOADS), refuse
 * non-staff callers, and only then hand the file to the document service.
 */
const state = vi.hoisted(() => ({ user: null as AppUser | null, available: false, uploads: [] as unknown[] }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) => (key: string, values?: Record<string, unknown>) => `${namespace}.${key}${values ? JSON.stringify(values) : ""}`,
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/lib/config/env", async (original) => ({ ...(await original<typeof import("@/lib/config/env")>()), documentUploadsAvailable: () => state.available }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/storage/supabase-storage", () => ({ supabaseDocumentStorage: () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/lib/email/dispatch", () => ({ deliverQueuedEmailsSoon: vi.fn() }));
vi.mock("@/lib/services/documents", () => ({
  uploadDocument: async (_db: unknown, _storage: unknown, user: AppUser, input: unknown) => {
    state.uploads.push({ user: user.id, input });
    return { ok: true, id: "doc-1" };
  },
}));

const { staffUploadDocumentAction } = await import("@/app/[locale]/admin/actions");

const staff: AppUser = { id: "00000000-0000-4000-8000-000000000001", email: "staff@example.test", role: "staff", customerId: null };
const customer: AppUser = { id: "00000000-0000-4000-8000-000000000002", email: "c@example.test", role: "customer", customerId: "c1" };
const form = (size = 1000, ownerType = "shipment") => {
  const fd = new FormData();
  fd.set("locale", "en");
  fd.set("ownerType", ownerType);
  fd.set("ownerId", "11111111-1111-4111-8111-111111111111");
  fd.set("file", new File([new Uint8Array(size)], "annex.pdf", { type: "application/pdf" }));
  return fd;
};
const IDLE = { status: "idle" } as const;

beforeEach(() => {
  state.user = staff;
  state.available = false;
  state.uploads = [];
});

describe("staff document upload action", () => {
  it("is refused while uploads are switched off, and stores nothing", async () => {
    expect(await staffUploadDocumentAction(IDLE, form())).toEqual({ status: "error", message: "portal.documents.unavailable" });
    expect(state.uploads).toEqual([]);
  });

  it("is refused for customers and signed-out callers even when uploads are on", async () => {
    state.available = true;
    for (const user of [customer, null]) {
      state.user = user;
      expect(await staffUploadDocumentAction(IDLE, form())).toMatchObject({ status: "error", message: "common.notAllowed" });
    }
    expect(state.uploads).toEqual([]);
  });

  it("checks the owner type and the 4 MB limit before calling the document service", async () => {
    state.available = true;
    expect(await staffUploadDocumentAction(IDLE, form(1000, "customer"))).toMatchObject({ status: "error" });
    expect(await staffUploadDocumentAction(IDLE, form(0))).toEqual({ status: "error", message: "portal.documents.errors.empty" });
    expect(await staffUploadDocumentAction(IDLE, form(4 * 1024 * 1024 + 1))).toEqual({ status: "error", message: 'portal.documents.errors.too_large{"max":4}' });
    expect(state.uploads).toEqual([]);
  });

  it("uploads as the signed-in staff member when uploads are on", async () => {
    state.available = true;
    expect(await staffUploadDocumentAction(IDLE, form(4 * 1024 * 1024))).toEqual({ status: "ok", message: "portal.documents.uploaded" });
    expect(state.uploads).toMatchObject([{ user: staff.id, input: { ownerType: "shipment", ownerId: "11111111-1111-4111-8111-111111111111", fileName: "annex.pdf" } }]);
  });
});
