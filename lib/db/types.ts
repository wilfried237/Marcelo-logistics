import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Works for both the postgres-js runtime driver and the PGlite test driver. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
