import { z } from "zod";
import {
  DRAFT_SCHEMA_VERSION,
  draftIdSchema,
  type Draft,
  type DraftErrorResponse,
  type SaveDraftRequest,
} from "@/lib/drafts/contract";
import { invitationDraftSchema } from "@/lib/invitation-schema";

const responseSchema = z.object({
  draft: z.object({
    id: draftIdSchema,
    templateId: draftIdSchema,
    templateKey: z.string(),
    schemaVersion: z.literal(DRAFT_SCHEMA_VERSION),
    version: z.number().int().positive(),
    updatedAt: z.iso.datetime({ offset: true }),
    data: invitationDraftSchema,
  }),
});
const errorSchema = z.object({
  error: z.object({
    issues: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional(),
  }),
});

export type FieldIssue = NonNullable<
  DraftErrorResponse["error"]["issues"]
>[number];
type Result = { draft: Draft } | { status: number; issues?: FieldIssue[] };

async function requestDraft(url: string, init?: RequestInit): Promise<Result> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...init,
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const parsed = errorSchema.safeParse(body);
      return { status: response.status, issues: parsed.data?.error.issues };
    }
    const parsed = responseSchema.safeParse(body);
    if (parsed.success) return parsed.data;
  } catch {
    // Keep the current form intact if the browser cannot confirm the response.
  }
  return { status: 0 };
}

function json(method: "POST" | "PUT", payload: object): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export function createStudioDraft(templateKey: string) {
  return requestDraft(
    "/api/drafts",
    json("POST", {
      templateKey,
      schemaVersion: DRAFT_SCHEMA_VERSION,
      data: {},
    }),
  );
}

export function getStudioDraft(id: string) {
  return requestDraft(`/api/drafts/${encodeURIComponent(id)}`);
}

export function saveStudioDraft(id: string, snapshot: SaveDraftRequest) {
  return requestDraft(
    `/api/drafts/${encodeURIComponent(id)}`,
    json("PUT", snapshot),
  );
}
