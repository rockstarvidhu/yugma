import "server-only";
import sharp from "sharp";
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_PIXELS,
  matchesPhotoSignature,
  type PhotoUploadRequest,
} from "./contract";

const formats = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export class InvalidPhoto extends Error {}

export async function readLimitedBytes(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new InvalidPhoto();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) {
        void reader.cancel().catch(() => undefined);
        throw new InvalidPhoto();
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

export async function normalizePhoto(
  input: Buffer,
  type: PhotoUploadRequest["type"],
) {
  if (!matchesPhotoSignature(input, type)) throw new InvalidPhoto();
  try {
    const source = sharp(input, {
      limitInputPixels: MAX_PHOTO_PIXELS,
      failOn: "warning",
    });
    const info = await source.metadata();
    if (info.format !== formats[type] || (info.pages ?? 1) !== 1)
      throw new InvalidPhoto();
    // Re-encode pixels to strip EXIF, scripts or trailing data. No original is served.
    const converted = await source
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .timeout({ seconds: 5 })
      .toBuffer({ resolveWithObject: true });
    if (converted.data.length > MAX_PHOTO_BYTES) throw new InvalidPhoto();
    return {
      bytes: new Uint8Array(converted.data),
      width: converted.info.width,
      height: converted.info.height,
    };
  } catch {
    throw new InvalidPhoto();
  }
}

export async function finalMetadata(response: Response) {
  const bytes = await readLimitedBytes(response, MAX_PHOTO_BYTES);
  const info = await sharp(bytes, { limitInputPixels: 2400 * 2400 }).metadata();
  if (
    response.headers.get("content-type") !== "image/webp" ||
    info.format !== "webp" ||
    !info.width ||
    !info.height
  )
    throw new Error("Unexpected normalized object");
  return { size: bytes.length, width: info.width, height: info.height };
}
