// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PHOTO_BYTES, type PhotoUploadRequest } from "./contract";
import { beginMedia, completeMedia, getMedia } from "./http";
import { InvalidPhoto, normalizePhoto } from "./image";

const m = vi.hoisted(() => ({
  getSession: vi.fn(),
  loadDraft: vi.fn(),
  rpc: vi.fn(),
  lookup: vi.fn(),
  owned: vi.fn(),
  signUpload: vi.fn(),
  staging: vi.fn(),
  final: vi.fn(),
  writeFinal: vi.fn(),
  deleteStaging: vi.fn(),
  deleteFinal: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getVerifiedSession: m.getSession }));
vi.mock("@/lib/drafts/store", () => ({ loadDraft: m.loadDraft }));
vi.mock("@/lib/auth/service", () => ({
  createServiceClient: () => ({
    rpc: m.rpc,
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: m.lookup,
      };
      return query;
    },
  }),
}));
vi.mock("./storage", () => ({
  finalKey: (draft: string, id: string) => "draft-media/" + draft + "/" + id,
  openStorage: () => ({
    signUpload: m.signUpload,
    staging: m.staging,
    final: m.final,
    writeFinal: m.writeFinal,
    deleteStaging: m.deleteStaging,
    deleteFinal: m.deleteFinal,
  }),
}));

const draft = "a1000000-0000-4000-8000-000000000001";
const asset = "a2000000-0000-4000-8000-000000000001";
const ownerId = "a3000000-0000-4000-8000-000000000001";
const startRequest = (body: unknown) =>
  new Request("http://localhost/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const completeRequest = () => startRequest({});
const empty = (status: number) => new Response(null, { status });
function photoResponse(input: Buffer, type: string) {
  return new Response(new Uint8Array(input), {
    headers: { "Content-Type": type, "Content-Length": String(input.length) },
  });
}
async function photo(format: "jpeg" | "png" | "webp") {
  return sharp({
    create: { width: 16, height: 24, channels: 3, background: "orange" },
  })
    .toFormat(format)
    .toBuffer();
}
function reserve(bytes: number, expires = "2099-01-01T00:00:00Z") {
  m.lookup.mockResolvedValue({
    data: { input_type: "image/png", input_size: bytes, expires_at: expires },
    error: null,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: () => query, eq: () => query, maybeSingle: m.owned };
  m.getSession.mockResolvedValue({ ownerId, client: { from: () => query } });
  m.loadDraft.mockResolvedValue({ id: draft });
  m.owned.mockResolvedValue({ data: null, error: null });
  m.lookup.mockResolvedValue({ data: null, error: null });
  m.final.mockImplementation(async () => empty(404));
  m.staging.mockImplementation(async () => empty(404));
  m.writeFinal.mockImplementation(async () => empty(200));
  m.deleteStaging.mockResolvedValue(undefined);
  m.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "reserve_draft_media"
        ? "reserved"
        : name === "register_draft_media"
          ? true
          : [],
    error: null,
  }));
  m.signUpload.mockResolvedValue("https://private.example/test-grant");
});

describe("private draft media HTTP", () => {
  it("requires a verified session for reservation, completion and retrieval", async () => {
    m.getSession.mockResolvedValue(null);
    expect(
      (await beginMedia(startRequest({ type: "image/png", bytes: 1 }), draft))
        .status,
    ).toBe(401);
    expect((await completeMedia(completeRequest(), draft, asset)).status).toBe(
      401,
    );
    expect((await getMedia(draft, asset)).status).toBe(401);
    expect(m.loadDraft).not.toHaveBeenCalled();
  });

  it("hides other owners' drafts and invalid route IDs", async () => {
    m.loadDraft.mockResolvedValueOnce(null);
    expect((await getMedia(draft, asset)).status).toBe(404);
    expect(
      (await completeMedia(completeRequest(), "invalid", asset)).status,
    ).toBe(404);
    expect((await getMedia(draft, "invalid")).status).toBe(404);
    expect(m.final).not.toHaveBeenCalled();
  });

  it.each([
    { type: "image/svg+xml", bytes: 18 },
    { type: "image/png", bytes: MAX_PHOTO_BYTES + 1 },
    { type: "image/png", bytes: 50, objectKey: "another-owner/photo" },
  ])("rejects invalid reservation metadata %#", async (payload) => {
    expect((await beginMedia(startRequest(payload), draft)).status).toBe(422);
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.signUpload).not.toHaveBeenCalled();
  });

  it("reserves and signs a random key under the verified owner and draft", async () => {
    const response = await beginMedia(
      startRequest({ type: "image/png", bytes: 48 }),
      draft,
    );
    const value = await response.json();
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(value.assetId).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.signUpload).toHaveBeenCalledWith(draft, value.assetId, {
      type: "image/png",
      bytes: 48,
    });
    expect(m.rpc).toHaveBeenCalledWith(
      "reserve_draft_media",
      expect.objectContaining({
        p_id: value.assetId,
        p_owner: ownerId,
        p_draft: draft,
      }),
    );
  });

  it("does not disclose a grant when the database denies the quota", async () => {
    m.rpc.mockResolvedValueOnce({ data: "quota", error: null });
    const response = await beginMedia(
      startRequest({ type: "image/png", bytes: 48 }),
      draft,
    );
    expect(response.status).toBe(429);
    expect(await response.json()).not.toHaveProperty("uploadUrl");
  });

  it("rejects forged completion keys, missing reservations and expired reservations", async () => {
    const forged = new Request("http://localhost/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectKey: "forged" }),
    });
    expect((await completeMedia(forged, draft, asset)).status).toBe(400);
    expect((await completeMedia(completeRequest(), draft, asset)).status).toBe(
      404,
    );
    reserve(10, "2000-01-01T00:00:00Z");
    expect((await completeMedia(completeRequest(), draft, asset)).status).toBe(
      410,
    );
    expect(m.staging).not.toHaveBeenCalled();
  });

  it("reports a failed or missing PUT without registering a photo", async () => {
    reserve(10);
    expect((await completeMedia(completeRequest(), draft, asset)).status).toBe(
      409,
    );
    expect(m.rpc).not.toHaveBeenCalledWith(
      "register_draft_media",
      expect.anything(),
    );
  });

  it("rejects a mislabeled PNG and keeps its staging key occupied until expiry", async () => {
    const fake = Buffer.from("<svg><script>bad</script></svg>");
    reserve(fake.length);
    m.staging.mockResolvedValue(photoResponse(fake, "image/png"));
    expect((await completeMedia(completeRequest(), draft, asset)).status).toBe(
      422,
    );
    expect(m.deleteStaging).not.toHaveBeenCalled();
    expect(m.writeFinal).not.toHaveBeenCalled();
  });

  it("verifies, normalizes and registers an owner photo idempotently", async () => {
    const input = await photo("png");
    reserve(input.length);
    m.staging.mockResolvedValue(photoResponse(input, "image/png"));
    const first = await completeMedia(completeRequest(), draft, asset);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ assetId: asset });
    const normalized = m.writeFinal.mock.calls[0][2];
    expect((await sharp(normalized).metadata()).format).toBe("webp");
    m.owned.mockResolvedValue({
      data: { size_bytes: normalized.length },
      error: null,
    });
    expect((await completeMedia(completeRequest(), draft, asset)).status).toBe(
      200,
    );
    expect(m.writeFinal).toHaveBeenCalledTimes(1);
    expect(m.deleteStaging).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("register_draft_media", {
      p_owner: ownerId,
      p_draft: draft,
      p_id: asset,
      p_width: 16,
      p_height: 24,
      p_size: normalized.length,
    });
  });

  it("reports registration failure and retries using the existing normalized file", async () => {
    const file = await photo("webp");
    reserve(file.length);
    m.final.mockImplementation(async () => photoResponse(file, "image/webp"));
    m.rpc.mockResolvedValueOnce({ error: { code: "08006" } });
    expect((await completeMedia(completeRequest(), draft, asset)).status).toBe(
      502,
    );
    expect((await completeMedia(completeRequest(), draft, asset)).status).toBe(
      200,
    );
    expect(m.writeFinal).not.toHaveBeenCalled();
  });

  it("streams the registered owner's file with private headers and no storage redirect", async () => {
    const file = await photo("webp");
    expect((await getMedia(draft, asset)).status).toBe(404);
    m.owned.mockResolvedValue({
      data: { size_bytes: file.length },
      error: null,
    });
    m.final.mockResolvedValue(photoResponse(file, "image/webp"));
    const result = await getMedia(draft, asset);
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("image/webp");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(result.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin",
    );
    expect(result.headers.get("location")).toBeNull();
    expect(Buffer.from(await result.arrayBuffer())).toEqual(file);
  });
});

describe("photo contents", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "decodes and re-encodes valid %s",
    async (format) => {
      const result = await normalizePhoto(
        await photo(format),
        ("image/" + format) as PhotoUploadRequest["type"],
      );
      expect((await sharp(result.bytes).metadata()).format).toBe("webp");
    },
  );

  it("rejects a PNG signature without valid pixels", async () => {
    await expect(
      normalizePhoto(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).rejects.toBeInstanceOf(InvalidPhoto);
  });
});
