import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { getDatabaseUrl } from "@/lib/config/env";
import { pgConnectionOptions } from "./connection.mjs";
import type { Database } from "./types";

/**
 * One Prisma client per server instance (cached on globalThis so hot reload in
 * development does not open new pools). Uses DATABASE_URL: on Supabase, the
 * transaction pooler (port 6543). The pool is small because serverless
 * instances are many and short-lived. Never imported by client components
 * (enforced by scripts/check-security.mjs and the server-only marker).
 */
const globalForDb = globalThis as unknown as { __mlPrisma?: Database };

export function createPrismaClient(connectionString: string, max = 5): Database {
  // Supabase hosts: TLS verified against the pinned Supabase root CA (connection.mjs).
  const adapter = new PrismaPg({ ...pgConnectionOptions(connectionString), max, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 });
  return new PrismaClient({ adapter, log: ["error"] });
}

export function getDb(): Database {
  if (!globalForDb.__mlPrisma) globalForDb.__mlPrisma = createPrismaClient(getDatabaseUrl());
  return globalForDb.__mlPrisma;
}
