import "server-only";
import { getVerifiedSession } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import { loadDraft, loadOwnedPublishedInvitation } from "@/lib/drafts/store";
import {
  completeUploadSchema,
  MAX_PHOTO_BYTES,
  uploadRequestSchema,
} from "./contract";
import {
  InvalidPhoto,
  finalMetadata,
  normalizePhoto,
  readLimitedBytes,
} from "./image";
import { finalKey, openStorage } from "./storage";

const headers = { "Cache-Control": "private, no-store" };
const uuid = (id: string) =>
  draftIdSchema.safeParse(id).success && id === id.toLowerCase();
const failure = (status: number, message: string) =>
  Response.json({ message }, { status, headers });
const missingDraft = () => failure(404, "Draft not found.");
const missingPhoto = () => failure(404, "Photo not found.");
const invalidPhoto = () =>
  failure(422, "Choose a valid JPEG, PNG or WebP photo up to 5 MB.");

type Session = NonNullable<Awaited<ReturnType<typeof getVerifiedSession>>>;
type Storage = NonNullable<ReturnType<typeof openStorage>>;

async function withOwnedDraft(
  draft: string,
  asset: string | undefined,
  operation: (session: Session, bucket: Storage) => Promise<Response>,
  readPublished = false,
) {
  try {
    const session = await getVerifiedSession();
    if (!session) return failure(401, "Sign in to access your draft photos.");
    if (
      !uuid(draft) ||
      !(
        (await loadDraft(session, draft)) ??
        (readPublished
          ? await loadOwnedPublishedInvitation(session, draft)
          : null)
      )
    )
      return missingDraft();
    if (asset !== undefined && !uuid(asset)) return missingPhoto();
    const bucket = openStorage();
    if (!bucket)
      return failure(503, "Private photo uploads are temporarily unavailable.");
    return await operation(session, bucket);
  } catch {
    return failure(502, "Photo storage is temporarily unavailable. Try again.");
  }
}

async function ownedAsset(session: Session, draft: string, id: string) {
  const { data, error } = await session.client
    .from("assets")
    .select("size_bytes")
    .eq("id", id)
    .eq("invitation_id", draft)
    .eq("owner_id", session.ownerId)
    .eq("object_key", finalKey(draft, id))
    .eq("media_type", "image/webp")
    .maybeSingle();
  if (error) throw error;
  return data &&
    Number.isInteger(data.size_bytes) &&
    data.size_bytes > 0 &&
    data.size_bytes <= MAX_PHOTO_BYTES
    ? Number(data.size_bytes)
    : null;
}

async function cleanupExpired(
  service: ReturnType<typeof createServiceClient>,
  bucket: Storage,
  owner: string,
  draft: string,
) {
  const { data } = await service.rpc("expired_draft_media", {
    p_owner: owner,
    p_draft: draft,
  });
  if (!Array.isArray(data)) return;

  await Promise.allSettled(
    data
      .filter(({ id }) => typeof id === "string" && uuid(id))
      .map(async ({ id }) => {
        await Promise.all([
          bucket.deleteStaging(draft, id),
          bucket.deleteFinal(draft, id),
        ]);
        await service
          .from("draft_media_uploads")
          .delete()
          .eq("id", id)
          .eq("invitation_id", draft)
          .eq("owner_id", owner);
      }),
  );
}

async function readUploadRequest(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return null;
  if (Number(request.headers.get("content-length")) > 1024) return null;
  try {
    const raw = await readLimitedBytes(new Response(request.body), 1024);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    return null;
  }
}

export function beginMedia(request: Request, draft: string) {
  return withOwnedDraft(draft, undefined, async ({ ownerId }, bucket) => {
    const result = uploadRequestSchema.safeParse(
      await readUploadRequest(request),
    );
    if (!result.success) return invalidPhoto();

    const service = createServiceClient();
    const id = crypto.randomUUID();
    const uploadUrl = await bucket.signUpload(draft, id, result.data);
    const { data, error } = await service.rpc("reserve_draft_media", {
      p_owner: ownerId,
      p_draft: draft,
      p_id: id,
      p_type: result.data.type,
      p_size: result.data.bytes,
    });
    if (error) throw error;
    if (data === "missing") return missingDraft();
    if (data === "quota")
      return failure(
        429,
        "Photo upload limit reached. A draft can have up to five uploads and three pending at once.",
      );
    if (data !== "reserved") throw new Error("Unexpected reservation response");
    await cleanupExpired(service, bucket, ownerId, draft).catch(
      () => undefined,
    );

    return Response.json({ assetId: id, uploadUrl }, { status: 201, headers });
  });
}

export function completeMedia(request: Request, draft: string, id: string) {
  return withOwnedDraft(draft, id, async (session, bucket) => {
    if (
      !completeUploadSchema.safeParse(await readUploadRequest(request)).success
    )
      return failure(400, "Send an empty JSON object to verify the photo.");
    const complete = () => Response.json({ assetId: id }, { headers });
    if (await ownedAsset(session, draft, id)) return complete();

    const service = createServiceClient();
    const { data, error } = await service
      .from("draft_media_uploads")
      .select("input_type,input_size,expires_at")
      .eq("id", id)
      .eq("invitation_id", draft)
      .eq("owner_id", session.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return missingPhoto();
    if (Date.parse(data.expires_at) <= Date.now())
      return failure(410, "This photo upload expired. Select the photo again.");
    const expected = uploadRequestSchema.parse({
      type: data.input_type,
      bytes: data.input_size,
    });

    async function readFinal() {
      const response = await bucket.final(draft, id);
      if (response.status === 404) {
        void response.body?.cancel().catch(() => undefined);
        return;
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error("Private photo read failed");
      }
      return finalMetadata(response);
    }

    let photo = await readFinal();
    if (!photo) {
      const incoming = await bucket.staging(draft, id);
      if (incoming.status === 404) {
        void incoming.body?.cancel().catch(() => undefined);
        // Another completion may have written the final object and deleted staging.
        photo = await readFinal();
        if (!photo)
          return failure(
            409,
            "The photo has not reached storage. Try uploading it again.",
          );
      } else {
        if (!incoming.ok) {
          void incoming.body?.cancel().catch(() => undefined);
          throw new Error("Photo staging read failed");
        }
        try {
          if (
            incoming.headers.get("content-type") !== expected.type ||
            Number(incoming.headers.get("content-length")) !== expected.bytes
          ) {
            void incoming.body?.cancel().catch(() => undefined);
            throw new InvalidPhoto();
          }
          const bytes = await readLimitedBytes(incoming, expected.bytes);
          if (bytes.length !== expected.bytes) throw new InvalidPhoto();
          const normalized = await normalizePhoto(bytes, expected.type);
          const written = await bucket.writeFinal(draft, id, normalized.bytes);
          void written.body?.cancel().catch(() => undefined);
          if (written.status === 412) photo = await readFinal();
          else if (written.ok)
            photo = {
              size: normalized.bytes.length,
              width: normalized.width,
              height: normalized.height,
            };
          if (!photo) throw new Error("Photo write failed");
        } catch (error) {
          if (!(error instanceof InvalidPhoto)) throw error;
          // Keep the key occupied for the lifetime of the write-once grant.
          return invalidPhoto();
        }
      }
    }

    const { data: registered, error: registrationError } = await service.rpc(
      "register_draft_media",
      {
        p_owner: session.ownerId,
        p_draft: draft,
        p_id: id,
        p_width: photo.width,
        p_height: photo.height,
        p_size: photo.size,
      },
    );
    if (registrationError) throw registrationError;
    if (!registered)
      return failure(
        410,
        "This photo upload expired or the draft is unavailable.",
      );
    // The bucket lifecycle expires staging after the grant can no longer write.
    return complete();
  });
}

export function getMedia(draft: string, id: string) {
  return withOwnedDraft(
    draft,
    id,
    async (session, bucket) => {
      const size = await ownedAsset(session, draft, id);
      if (!size) return missingPhoto();

      const response = await bucket.final(draft, id);
      if (response.status === 404) {
        void response.body?.cancel().catch(() => undefined);
        return missingPhoto();
      }
      if (
        !response.ok ||
        response.headers.get("content-type") !== "image/webp" ||
        Number(response.headers.get("content-length")) !== size ||
        !response.body
      ) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error("Private photo read failed");
      }

      return new Response(response.body, {
        headers: {
          ...headers,
          "Content-Type": "image/webp",
          "Content-Length": String(size),
          "X-Content-Type-Options": "nosniff",
          "Cross-Origin-Resource-Policy": "same-origin",
          "Referrer-Policy": "no-referrer",
        },
      });
    },
    true,
  );
}
