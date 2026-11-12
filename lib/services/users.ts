import { withSystem, withUser } from "@/lib/db/context";
import { domainErrorCode } from "@/lib/db/errors";
import type { Database } from "@/lib/db/types";
import { assertAdmin, assertStaff, type AppUser } from "@/lib/auth/types";
import { USER_ROLES, type UserRole } from "@/lib/domain/enums";
import type { StaffActionResult } from "./quote-requests";

/**
 * Loads the authoritative role and customer link for an authenticated user id.
 * The id must come from a verified Supabase session (supabase.auth.getUser()).
 */
export async function loadAppUser(db: Database, userId: string, email: string | null): Promise<AppUser | null> {
  const profile = await withSystem(db, null, (tx) =>
    tx.profile.findUnique({ where: { id: userId }, select: { role: true, user: { select: { customer: { select: { id: true } } } } } }),
  );
  if (!profile) return null;
  return { id: userId, email, role: profile.role, customerId: profile.user.customer?.id ?? null };
}

export async function getOwnCustomerProfile(db: Database, user: AppUser) {
  if (!user.customerId) return null;
  return withUser(db, user.id, (tx) =>
    tx.customer.findUnique({ where: { id: user.customerId! }, select: { name: true, email: true, phone: true, preferredLocale: true } }),
  );
}

export async function updateOwnCustomerProfile(
  db: Database,
  user: AppUser,
  input: { name: string; phone: string | null; preferredLocale: "en" | "fr" },
): Promise<StaffActionResult> {
  if (!user.customerId) return { ok: false, code: "not_found" };
  try {
    const updated = await withUser(db, user.id, (tx) => tx.customer.updateMany({ where: { id: user.customerId! }, data: input }));
    return updated.count ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

export async function listCustomersForStaff(db: Database, user: AppUser) {
  assertStaff(user);
  const rows = await withUser(db, user.id, (tx) =>
    tx.customer.findMany({ select: { id: true, name: true, email: true, phone: true, userId: true, createdAt: true }, orderBy: { name: "asc" }, take: 500 }),
  );
  return rows.map(({ userId, ...c }) => ({ ...c, hasAccount: userId !== null }));
}

export async function listUsersForAdmin(db: Database, user: AppUser) {
  assertAdmin(user);
  const rows = await withUser(db, user.id, (tx) =>
    tx.profile.findMany({ select: { id: true, role: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 500 }),
  );
  // Names/emails come from the linked customer record (RLS: staff may read customers).
  const customers = await withUser(db, user.id, (tx) =>
    tx.customer.findMany({ where: { userId: { in: rows.map((r) => r.id) } }, select: { userId: true, name: true, email: true } }),
  );
  const byUser = new Map(customers.map((c) => [c.userId, c]));
  return rows.map((r) => ({ ...r, name: byUser.get(r.id)?.name ?? null, email: byUser.get(r.id)?.email ?? null }));
}

/** Role changes go through the admin-only database function, which also audits them. */
export async function setUserRole(db: Database, user: AppUser, targetUserId: string, role: UserRole): Promise<StaffActionResult> {
  assertAdmin(user);
  if (!USER_ROLES.includes(role) || !/^[0-9a-f-]{36}$/i.test(targetUserId)) return { ok: false, code: "invalid" };
  try {
    await withUser(db, user.id, (tx) => tx.$executeRaw`select public.admin_set_user_role(${targetUserId}::uuid, ${role}::public.user_role)`);
    return { ok: true };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}
