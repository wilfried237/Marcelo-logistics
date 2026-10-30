import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

/** The application's Prisma client (runtime: node-postgres adapter; tests: PGlite over a socket). */
export type Database = PrismaClient;
/** Client inside an interactive transaction. */
export type Tx = Prisma.TransactionClient;
