export async function readJsonBodyBytes(request: Request, maxBytes: number) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json" || !request.body) return null;
  if (Number(request.headers.get("content-length")) > maxBytes) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, bytes);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function parseJson(body: Uint8Array | null): unknown {
  if (!body) return null;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return null;
  }
}
