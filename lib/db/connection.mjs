// Database connection settings shared by the app (lib/db/client.ts) and the
// migration scripts (scripts/*.mjs). Plain JavaScript so both can import it.

/**
 * Supabase Root 2021 CA (public certificate; valid until 2031-04-26).
 * SHA-256 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA,
 * checked on 2026-11-03 against both the chain served by the Supabase pooler and
 * Supabase's published prod-ca-2021.crt. Same file: prisma/supabase-root-2021.crt.
 * Supabase signs its database and pooler certificates with this private CA, which
 * Node does not trust by default; pinning it keeps full verification on.
 */
export const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;

/**
 * Connection URLs. The Vercel Supabase integration manages POSTGRES_URL
 * (pooled) and POSTGRES_URL_NON_POOLING (session mode, IPv4); when present they
 * take precedence over hand-copied values. DATABASE_URL / DIRECT_URL remain for
 * local development and manual setups.
 * @param {Record<string, string | undefined>} env
 */
export function resolveDatabaseUrls(env = process.env) {
  const pick = (...names) => names.map((n) => env[n]).find((v) => typeof v === "string" && v.trim() !== "")?.trim();
  return {
    /** Used by the running app (pooled). */
    app: pick("POSTGRES_URL", "DATABASE_URL"),
    /** Used by migrations (session connection). */
    direct: pick("POSTGRES_URL_NON_POOLING", "DIRECT_URL"),
  };
}

/** @param {string} connectionString */
export function isSupabaseHost(connectionString) {
  try {
    const host = new URL(connectionString).hostname;
    return host.endsWith(".supabase.com") || host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

/**
 * node-postgres options. For Supabase hosts: TLS with full verification against
 * the pinned Supabase root CA. The URL's sslmode is dropped because node-postgres
 * would otherwise verify against the default (public) CAs only and fail.
 * Other hosts (local development) are passed through unchanged.
 * @param {string} connectionString
 */
export function pgConnectionOptions(connectionString) {
  if (!isSupabaseHost(connectionString)) return { connectionString };
  const url = new URL(connectionString);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) url.searchParams.delete(key);
  return { connectionString: url.toString(), ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true } };
}

/**
 * URL for the Prisma CLI (schema engine). For Supabase hosts: verify the server
 * certificate strictly against the pinned root CA file.
 * @param {string} connectionString
 * @param {string} caFile absolute path to prisma/supabase-root-2021.crt
 */
export function prismaCliUrl(connectionString, caFile) {
  if (!isSupabaseHost(connectionString)) return connectionString;
  const url = new URL(connectionString);
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("sslcert", caFile);
  url.searchParams.set("sslaccept", "strict");
  return url.toString();
}
