import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_MEGABYTES, SERVER_ACTION_BODY_LIMIT_BYTES, VERCEL_REQUEST_BODY_LIMIT_BYTES } from "@/lib/config/upload-limits";
import { MAX_DOCUMENT_BYTES as FROM_ENUMS } from "@/lib/domain/enums";

/** D1 (Stage 6): 4 MB per file, delivered through a Server Action, on Vercel. */
describe("document upload limits", () => {
  it("allows 4 MB files", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(4 * 1024 * 1024);
    expect(MAX_DOCUMENT_MEGABYTES).toBe(4);
    expect(FROM_ENUMS).toBe(MAX_DOCUMENT_BYTES);
  });

  it("lets a full 4 MB file plus multipart overhead through the Server Action, and stays under Vercel's 4.5 MB ceiling", () => {
    expect(SERVER_ACTION_BODY_LIMIT_BYTES - MAX_DOCUMENT_BYTES).toBeGreaterThanOrEqual(64 * 1024);
    expect(SERVER_ACTION_BODY_LIMIT_BYTES).toBeLessThan(VERCEL_REQUEST_BODY_LIMIT_BYTES);
    expect(VERCEL_REQUEST_BODY_LIMIT_BYTES).toBeLessThanOrEqual(4.5 * 1024 * 1024); // both readings of "4.5 MB"
  });

  it("is the limit Next.js actually applies to Server Actions", () => {
    const config = typeof nextConfig === "function" ? null : nextConfig;
    expect(config?.experimental?.serverActions?.bodySizeLimit).toBe(SERVER_ACTION_BODY_LIMIT_BYTES);
  });
});
