import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_MEGABYTES, UPLOAD_REQUEST_MAX_BYTES, VERCEL_REQUEST_BODY_LIMIT_BYTES } from "@/lib/config/upload-limits";
import { MAX_DOCUMENT_BYTES as FROM_ENUMS } from "@/lib/domain/enums";
import { readLimitedBody } from "@/lib/http/read-limited-body";

/** D1 (Stage 6): 4 MB per file, uploaded through the dedicated route POST /api/documents. */
describe("document upload limits", () => {
  it("allows 4 MiB files", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(4_194_304);
    expect(MAX_DOCUMENT_MEGABYTES).toBe(4);
    expect(FROM_ENUMS).toBe(MAX_DOCUMENT_BYTES);
  });

  it("leaves room for multipart overhead and stays under Vercel's 4.5 MB request ceiling", () => {
    expect(UPLOAD_REQUEST_MAX_BYTES - MAX_DOCUMENT_BYTES).toBeGreaterThanOrEqual(16 * 1024);
    expect(UPLOAD_REQUEST_MAX_BYTES).toBeLessThan(VERCEL_REQUEST_BODY_LIMIT_BYTES);
    expect(VERCEL_REQUEST_BODY_LIMIT_BYTES).toBeLessThanOrEqual(4.5 * 1024 * 1024); // both readings of "4.5 MB"
  });

  it("keeps the project-wide Server Action body limit at the Next.js 1 MB default", () => {
    const config = typeof nextConfig === "function" ? null : nextConfig;
    expect(config).not.toBeNull();
    expect(config?.experimental?.serverActions?.bodySizeLimit).toBeUndefined();
  });
});

describe("reading a request body with a hard cap", () => {
  const stream = (chunks: number[], onPull?: () => void) => {
    let i = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        onPull?.();
        if (i < chunks.length) controller.enqueue(new Uint8Array(chunks[i++]));
        else controller.close();
      },
    });
  };

  it("returns the whole body when it fits, including exactly at the limit", async () => {
    expect(await readLimitedBody(stream([3, 4]), 7)).toHaveLength(7);
    expect(await readLimitedBody(null, 7)).toHaveLength(0);
  });

  it("stops reading as soon as the body passes the limit", async () => {
    let pulls = 0;
    expect(await readLimitedBody(stream([4, 4, 4, 4, 4, 4], () => pulls++), 7)).toBe("too_large");
    expect(pulls).toBeLessThanOrEqual(3); // never read the remaining chunks
  });
});
