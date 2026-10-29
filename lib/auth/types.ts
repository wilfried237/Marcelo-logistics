import type { UserRole } from "@/lib/domain/enums";

/** The signed-in user as known to the application. Role comes from public.profiles only. */
export interface AppUser {
  id: string;
  email: string | null;
  role: UserRole;
  customerId: string | null;
}

export const isStaff = (user: AppUser | null): boolean => user?.role === "staff" || user?.role === "admin";
export const isAdmin = (user: AppUser | null): boolean => user?.role === "admin";

export class AuthorizationError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function assertStaff(user: AppUser | null): asserts user is AppUser {
  if (!isStaff(user)) throw new AuthorizationError();
}

export function assertAdmin(user: AppUser | null): asserts user is AppUser {
  if (!isAdmin(user)) throw new AuthorizationError();
}
