import {
  imageTypeSchema,
  matchesPhotoSignature,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_PIXELS,
} from "./contract";

export async function preparePhotoPreview(file: File, signal: AbortSignal) {
  const type = imageTypeSchema.safeParse(file.type);
  if (!type.success) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (!file.size) throw new Error("Choose a photo that is not empty.");
  if (file.size > MAX_PHOTO_BYTES)
    throw new Error("Choose a photo up to 5 MiB.");

  let src: string | undefined;
  const unreadable =
    "We couldn’t open that photo. Choose a readable JPEG, PNG, or WebP image.";
  let pixels: number;
  try {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    signal.throwIfAborted();
    if (!matchesPhotoSignature(bytes, type.data)) throw new Error(unreadable);
    src = URL.createObjectURL(file);
    const image = new Image();
    image.src = src;
    await image.decode();
    signal.throwIfAborted();
    pixels = image.naturalHeight * image.naturalWidth;
    if (!pixels) throw new Error(unreadable);
  } catch {
    if (src) URL.revokeObjectURL(src);
    signal.throwIfAborted();
    throw new Error(unreadable);
  }
  if (pixels > MAX_PHOTO_PIXELS) {
    URL.revokeObjectURL(src);
    throw new Error("Choose a photo up to 20 megapixels.");
  }
  return src;
}
