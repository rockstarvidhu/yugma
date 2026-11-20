import { z } from "zod";
import { invitationDraftSchema } from "@/lib/invitation-schema";

export const DRAFT_SCHEMA_VERSION = 1;
export const MAX_DRAFT_BYTES = 128 * 1024;
export const DRAFT_PAGE_SIZE = 20;
export const draftIdSchema = z.uuid();

const registryKey = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const content = {
  schemaVersion: z.literal(DRAFT_SCHEMA_VERSION),
  data: invitationDraftSchema,
};

export const createDraftSchema = z.strictObject({
  ...content,
  templateKey: registryKey,
});
export const saveDraftSchema = z.strictObject({
  ...content,
  expectedVersion: z.number().int().positive().max(2_147_483_647),
});

export type CreateDraftRequest = z.input<typeof createDraftSchema>;
export type SaveDraftRequest = z.input<typeof saveDraftSchema>;

export type Draft = {
  id: string;
  templateId: string;
  templateKey: string;
  schemaVersion: typeof DRAFT_SCHEMA_VERSION;
  version: number;
  updatedAt: string;
  data: z.output<typeof invitationDraftSchema>;
};

export type DraftResponse = { draft: Draft };
export type DraftListResponse = { drafts: Draft[]; nextCursor: string | null };

export type DraftErrorResponse = {
  error: {
    code:
      | "UNAUTHENTICATED"
      | "DRAFT_NOT_FOUND"
      | "VERSION_CONFLICT"
      | "PAYLOAD_TOO_LARGE"
      | "INVALID_DRAFT"
      | "INTERNAL_ERROR";
    message: string;
    issues?: { path: string; message: string }[];
    currentVersion?: number;
  };
};
