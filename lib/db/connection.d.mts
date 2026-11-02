export declare const SUPABASE_ROOT_CA: string;
export declare function resolveDatabaseUrls(env?: Record<string, string | undefined>): { app?: string; direct?: string };
export declare function isSupabaseHost(connectionString: string): boolean;
export declare function pgConnectionOptions(connectionString: string): { connectionString: string; ssl?: { ca: string; rejectUnauthorized: true } };
export declare function prismaCliUrl(connectionString: string, caFile: string): string;
