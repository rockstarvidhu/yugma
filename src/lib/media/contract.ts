import { z } from "zod";
import { draftIdSchema } from "@/lib/drafts/contract";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 20_000_000;
export const UPLOAD_EXPIRY_SECONDS = 90;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const imageTypeSchema = z.enum(IMAGE_TYPES);
export const uploadRequestSchema = z.strictObject({
  type: imageTypeSchema,
  bytes: z.number().int().min(1).max(MAX_PHOTO_BYTES),
});
export const completeUploadSchema = z.strictObject({});
export const uploadTicketSchema = z.object({
  assetId: draftIdSchema,
  uploadUrl: z.url({ protocol: /^https?$/ }),
});
export type PhotoUploadRequest = z.infer<typeof uploadRequestSchema>;

export function matchesPhotoSignature(
  bytes: Uint8Array,
  type: PhotoUploadRequest["type"],
) {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((value, index) => bytes[offset + index] === value);
  switch (type) {
    case "image/jpeg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return (
        startsWith([0x52, 0x49, 0x46, 0x46]) &&
        startsWith([0x57, 0x45, 0x42, 0x50], 8)
      );
  }
}

const referencePrefix = "https://media.yugma.invalid/";
export const privatePhotoReference = (assetId: string) =>
  referencePrefix + assetId;

export function privatePhotoId(src?: string) {
  if (!src?.startsWith(referencePrefix)) return;
  const id = src.slice(referencePrefix.length);
  return draftIdSchema.safeParse(id).success && id === id.toLowerCase()
    ? id
    : undefined;
}
export const draftMediaPath = (draft: string, asset?: string) =>
  `/api/drafts/${draft}/media${asset ? `/${asset}` : ""}`;
