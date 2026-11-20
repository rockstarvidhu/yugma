import "server-only";
import { z } from "zod";
import { getServerAuth } from "@/lib/auth/server";
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

async function requestBody<T extends { data: unknown }>(
  request: Request,
  schema: z.ZodType<T>,
) {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES)
    return { response: failure(413, sizeError) };
  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json" || !request.body)
    return { response: failure(422, invalidJson) };

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
      new TextEncoder().encode(JSON.stringify(value.data)).byteLength >
        MAX_DRAFT_BYTES
    )
      return { response: failure(413, sizeError) };
  } catch {
    return { response: failure(422, invalidJson) };
  } finally {
    reader.releaseLock();
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      response: failure(422, {
        code: "INVALID_DRAFT",
        message: "Correct the draft fields and try again.",
        issues: result.error.issues.slice(0, 20).map(({ path, message }) => ({
          path: path.map(String).join("."),
          message,
        })),
      }),
    };
  }
  return { data: result.data };
}

async function withDraftSession(
  operation: (session: {
    client: NonNullable<Awaited<ReturnType<typeof getServerAuth>>>;
    ownerId: string;
  }) => Promise<Response>,
) {
  try {
    const client = await getServerAuth({ writeCookies: true });
    if (client) {
      // Verify the current session with Auth before using the server write key.
      const { data, error } = await client.auth.getUser();
      const user = data?.user;
      if (!error && user?.role === "authenticated" && !user.is_anonymous)
        return await operation({ client, ownerId: user.id });
      if (error?.status && error.status >= 500) throw error;
    }
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
    const result = await requestBody(request, createDraftSchema);
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

export function saveDraft(request: Request, id: string) {
  return withDraftSession(async (session) => {
    if (!draftIdSchema.safeParse(id).success) return notFound();
    const result = await requestBody(request, saveDraftSchema);
    if (result.response) return result.response;
    const { data, expectedVersion } = result.data;
    const draft = await store.saveDraft(
      session.ownerId,
      id,
      expectedVersion,
      data,
    );
    if (draft)
      return Response.json({ draft } satisfies DraftResponse, { headers });

    // Distinguish a stale save only after the RLS-protected owner read succeeds.
    const current = await store.loadDraft(session, id);
    if (!current) return notFound();
    return failure(409, {
      code: "VERSION_CONFLICT",
      message: "The draft version has changed. Reload it before saving again.",
      currentVersion: current.version,
    });
  });
}
