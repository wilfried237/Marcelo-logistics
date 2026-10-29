import { asc, eq, sql } from "drizzle-orm";
import { withSystem, withUser } from "@/lib/db/context";
import { domainErrorCode } from "@/lib/db/errors";
import { customers, profiles } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { assertAdmin, assertStaff, type AppUser } from "@/lib/auth/types";
import { USER_ROLES, type UserRole } from "@/lib/domain/enums";
import type { StaffActionResult } from "./quote-requests";

/**
 * Loads the authoritative role and customer link for an authenticated user id.
 * The id must come from a verified Supabase session (supabase.auth.getUser()).
 */
export async function loadAppUser(db: Database, userId: string, email: string | null): Promise<AppUser | null> {
  const [row] = await withSystem(db, null, (tx) =>
    tx
      .select({ role: profiles.role, customerId: customers.id })
      .from(profiles)
      .leftJoin(customers, eq(customers.userId, profiles.id))
      .where(eq(profiles.id, userId)),
  );
  if (!row) return null;
  return { id: userId, email, role: row.role, customerId: row.customerId ?? null };
}

export async function getOwnCustomerProfile(db: Database, user: AppUser) {
  if (!user.customerId) return null;
  const [row] = await withUser(db, user.id, (tx) =>
    tx
      .select({ name: customers.name, email: customers.email, phone: customers.phone, preferredLocale: customers.preferredLocale })
      .from(customers)
      .where(eq(customers.id, user.customerId!)),
  );
  return row ?? null;
}

export async function updateOwnCustomerProfile(
  db: Database,
  user: AppUser,
  input: { name: string; phone: string | null; preferredLocale: "en" | "fr" },
): Promise<StaffActionResult> {
  if (!user.customerId) return { ok: false, code: "not_found" };
  try {
    const rows = await withUser(db, user.id, (tx) =>
      tx.update(customers).set(input).where(eq(customers.id, user.customerId!)).returning({ id: customers.id }),
    );
    return rows.length ? { ok: true } : { ok: false, code: "not_found" };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}

export async function listCustomersForStaff(db: Database, user: AppUser) {
  assertStaff(user);
  return withUser(db, user.id, (tx) =>
    tx
      .select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone, hasAccount: sql<boolean>`${customers.userId} is not null`, createdAt: customers.createdAt })
      .from(customers)
      .orderBy(asc(customers.name))
      .limit(500),
  );
}

export async function listUsersForAdmin(db: Database, user: AppUser) {
  assertAdmin(user);
  return withUser(db, user.id, (tx) =>
    tx
      .select({ id: profiles.id, role: profiles.role, name: customers.name, email: customers.email, createdAt: profiles.createdAt })
      .from(profiles)
      .leftJoin(customers, eq(customers.userId, profiles.id))
      .orderBy(asc(profiles.createdAt)),
  );
}

/** Role changes go through the admin-only database function, which also audits them. */
export async function setUserRole(db: Database, user: AppUser, targetUserId: string, role: UserRole): Promise<StaffActionResult> {
  assertAdmin(user);
  if (!USER_ROLES.includes(role)) return { ok: false, code: "invalid" };
  try {
    await withUser(db, user.id, (tx) => tx.execute(sql`select public.admin_set_user_role(${targetUserId}::uuid, ${role}::public.user_role)`));
    return { ok: true };
  } catch (error) {
    return { ok: false, code: domainErrorCode(error) };
  }
}
