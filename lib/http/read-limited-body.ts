/**
 * Reads a request body into memory, stopping as soon as it exceeds `maxBytes`.
 * The stream is cancelled at that point, so an oversized body (declared or not,
 * for example with chunked transfer encoding) is never buffered beyond the limit.
 */
export async function readLimitedBody(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array | "too_large"> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return "too_large";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
