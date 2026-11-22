import "server-only";
import { z } from "zod";
import { getVerifiedSession } from "@/lib/auth/server";
import {
  invitationDraftSchema,
  type InvitationDraft,
} from "@/lib/invitation-schema";
import { templateRegistry } from "@/templates/registry";
import {
  MAX_DRAFT_BYTES,
  createDraftSchema,
  draftIdSchema,
  saveDraftSchema,
  type DraftErrorResponse,
  type DraftListResponse,
  type DraftResponse,
} from "./contract";
import * as store from "./store";

const MAX_REQUEST_BYTES = MAX_DRAFT_BYTES + 1024; // Allow for the request envelope.
const headers = { "Cache-Control": "private, no-store" };
const sizeError = {
  code: "PAYLOAD_TOO_LARGE",
  message: "Draft data must be at most 128 KiB.",
} as const;
const invalidJson = {
  code: "INVALID_DRAFT",
  message: "Send a valid JSON draft request.",
} as const;

function failure(status: number, error: DraftErrorResponse["error"]) {
  return Response.json({ error } satisfies DraftErrorResponse, {
    status,
    headers,
  });
}

function notFound() {
  return failure(404, { code: "DRAFT_NOT_FOUND", message: "Draft not found." });
}

function invalidTextPath(value: unknown, path: string): string | undefined {
  if (typeof value === "string") {
    // JSON decoding accepts escaped NUL and lone surrogates that JSONB rejects.
    return value.includes("\0") || !value.isWellFormed() ? path : undefined;
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const invalid = invalidTextPath(child, `${path}.${key}`);
    if (invalid) return invalid;
  }
}

async function requestBody<T extends { data: unknown }>(
  request: Request,
  schema: z.ZodType<T>,
  invalidStatus: 400 | 422,
) {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES)
    return { response: failure(413, sizeError) };
  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json" || !request.body)
    return { response: failure(invalidStatus, invalidJson) };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let json = "";
  let bytes = 0;
  let value: unknown;
  try {
    for (;;) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      bytes += chunk.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { response: failure(413, sizeError) };
      }
      json += decoder.decode(chunk, { stream: true });
    }
    value = JSON.parse(json + decoder.decode());
    if (
      value !== null &&
      typeof value === "object" &&
      "data" in value &&
      exceedsDraftLimit(value.data)
    )
      return { response: failure(413, sizeError) };
  } catch {
    return { response: failure(invalidStatus, invalidJson) };
  } finally {
    reader.releaseLock();
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      response: invalidFields(invalidStatus, result.error.issues),
    };
  }

  const path = invalidTextPath(result.data.data, "data");
  if (path) {
    return {
      response: failure(invalidStatus, {
        code: "INVALID_DRAFT",
        message: "Correct the draft fields and try again.",
        issues: [
          { path, message: "Use valid Unicode text without NUL characters." },
        ],
      }),
    };
  }

  return { data: result.data };
}

function exceedsDraftLimit(data: unknown) {
  return (
    new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_DRAFT_BYTES
  );
}

function invalidFields(
  status: 400 | 422,
  issues: z.ZodError["issues"],
  prefix: string[] = [],
) {
  return failure(status, {
    code: "INVALID_DRAFT",
    message: "Correct the draft fields and try again.",
    issues: issues.slice(0, 20).map(({ path, message }) => ({
      path: [...prefix, ...path.map(String)].join("."),
      message,
    })),
  });
}

function mergeDraft(
  current: InvitationDraft,
  changes: InvitationDraft,
): InvitationDraft {
  const merged = { ...current, ...changes };
  if (changes.couple) merged.couple = { ...current.couple, ...changes.couple };
  if (changes.events?.length) {
    const events = new Map(current.events?.map((event) => [event.id, event]));
    for (const change of changes.events) {
      const event = events.get(change.id);
      events.set(change.id, {
        ...event,
        ...change,
        ...(change.venue && { venue: { ...event?.venue, ...change.venue } }),
      });
    }
    merged.events = [...events.values()];
  }
  return merged;
}

function versionConflict(version: number) {
  return failure(409, {
    code: "VERSION_CONFLICT",
    message: "The draft version has changed. Reload it before saving again.",
    currentVersion: version,
  });
}

async function withDraftSession(
  operation: (
    session: NonNullable<Awaited<ReturnType<typeof getVerifiedSession>>>,
  ) => Promise<Response>,
) {
  try {
    const session = await getVerifiedSession();
    if (session) return await operation(session);
    return failure(401, {
      code: "UNAUTHENTICATED",
      message: "Sign in to access your drafts.",
    });
  } catch {
    return failure(500, {
      code: "INTERNAL_ERROR",
      message: "Drafts are temporarily unavailable.",
    });
  }
}

export function listDrafts(request: Request) {
  return withDraftSession(async (session) => {
    const cursor = new URL(request.url).searchParams.getAll("after");
    if (
      cursor.length &&
      (cursor.length !== 1 || !draftIdSchema.safeParse(cursor[0]).success)
    )
      return failure(422, {
        code: "INVALID_DRAFT",
        message: "The draft list cursor is invalid.",
      });
    const result = await store.listDrafts(session, cursor[0] ?? null);
    return Response.json(result satisfies DraftListResponse, { headers });
  });
}

export function createDraft(request: Request) {
  return withDraftSession(async ({ ownerId }) => {
    const result = await requestBody(request, createDraftSchema, 422);
    if (result.response) return result.response;
    const { templateKey, data } = result.data;
    const draft = templateRegistry.get(templateKey)
      ? await store.createDraft(ownerId, templateKey, data)
      : null;
    if (!draft)
      return failure(422, {
        code: "INVALID_DRAFT",
        message: "This template cannot be used for private drafts.",
        issues: [
          { path: "templateKey", message: "Choose a draft-eligible template." },
        ],
      });
    return Response.json({ draft } satisfies DraftResponse, {
      status: 201,
      headers,
    });
  });
}

export function loadDraft(id: string) {
  return withDraftSession(async (session) => {
    if (!draftIdSchema.safeParse(id).success) return notFound();
    const draft = await store.loadDraft(session, id);
    return draft
      ? Response.json({ draft } satisfies DraftResponse, { headers })
      : notFound();
  });
}

export function saveDraft(
  request: Request,
  id: string,
  mode: "merge" | "replace" = "merge",
) {
  return withDraftSession(async (session) => {
    if (!draftIdSchema.safeParse(id).success) return notFound();
    const result = await requestBody(request, saveDraftSchema, 400);
    if (result.response) return result.response;
    const { data, expectedVersion } = result.data;
    const current = await store.loadDraft(session, id);
    if (!current) return notFound();
    if (current.version !== expectedVersion)
      return versionConflict(current.version);

    const next = invitationDraftSchema.safeParse(
      mode === "merge" ? mergeDraft(current.data, data) : data,
    );
    if (!next.success) return invalidFields(400, next.error.issues, ["data"]);
    if (exceedsDraftLimit(next.data)) return failure(413, sizeError);

    const draft = await store.saveDraft(
      session.ownerId,
      id,
      expectedVersion,
      next.data,
    );
    if (draft)
      return Response.json({ draft } satisfies DraftResponse, { headers });

    // Re-read under the caller's session after a write loses the database race.
    const latest = await store.loadDraft(session, id);
    return latest ? versionConflict(latest.version) : notFound();
  });
}
