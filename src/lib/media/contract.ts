import { z } from "zod";
import { draftIdSchema } from "@/lib/drafts/contract";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
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
