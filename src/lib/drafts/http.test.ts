// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Draft } from "./contract";
import { createDraft, listDrafts, loadDraft, saveDraft } from "./http";

const mocks = vi.hoisted(() => ({
  getServerAuth: vi.fn(),
  getUser: vi.fn(),
  createDraft: vi.fn(),
  listDrafts: vi.fn(),
  loadDraft: vi.fn(),
  saveDraft: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getServerAuth: mocks.getServerAuth }));
vi.mock("@/templates/registry", () => ({
  templateRegistry: {
    get: (id: string) => (id === "afterglow" ? {} : undefined),
  },
}));
vi.mock("./store", () => ({
  createDraft: mocks.createDraft,
  listDrafts: mocks.listDrafts,
  loadDraft: mocks.loadDraft,
  saveDraft: mocks.saveDraft,
}));

const ownerId = "e1000000-0000-4000-8000-000000000001";
const draft: Draft = {
  id: "e2000000-0000-4000-8000-000000000001",
  templateId: "e3000000-0000-4000-8000-000000000001",
  templateKey: "afterglow",
  schemaVersion: 1,
  version: 1,
  updatedAt: "2026-11-20T10:00:00Z",
  data: {},
};
const client = { auth: { getUser: mocks.getUser } };
const createInput = { templateKey: "afterglow", schemaVersion: 1, data: {} };
const updateInput = { expectedVersion: 1, schemaVersion: 1, data: {} };

function json(method: string, body: unknown) {
  return new Request("http://localhost/api/drafts", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getServerAuth.mockResolvedValue(client);
  mocks.getUser.mockResolvedValue({
    data: { user: { id: ownerId, role: "authenticated", is_anonymous: false } },
    error: null,
  });
});

describe("private draft HTTP contract", () => {
  it("creates an incomplete Afterglow draft for the verified session owner", async () => {
    mocks.createDraft.mockResolvedValue(draft);
    const response = await createDraft(json("POST", createInput));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ draft });
    expect(mocks.createDraft).toHaveBeenCalledWith(ownerId, "afterglow", {});
  });

  it("lists and loads only through the caller's session client", async () => {
    mocks.listDrafts.mockResolvedValue({ drafts: [draft], nextCursor: null });
    const url = new URL("http://localhost/api/drafts");
    url.searchParams.set("after", draft.id);
    const list = await listDrafts(new Request(url));
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ drafts: [draft], nextCursor: null });
    expect(mocks.listDrafts).toHaveBeenCalledWith(
      { client, ownerId },
      draft.id,
    );
    mocks.loadDraft.mockResolvedValue(draft);
    const detail = await loadDraft(draft.id);
    expect(await detail.json()).toEqual({ draft });
    expect(mocks.loadDraft).toHaveBeenCalledWith({ client, ownerId }, draft.id);
  });

  it("normalizes present canonical fields without requiring all invitation details", async () => {
    const data = {
      couple: { partnerOne: " Tara " },
      events: [{ id: "ceremony", venue: { name: "Sample Venue" } }],
    };
    const saved = { ...draft, version: 2 };
    mocks.saveDraft.mockResolvedValue(saved);
    const response = await saveDraft(
      json("PATCH", { ...updateInput, data }),
      draft.id,
    );
    expect(await response.json()).toEqual({ draft: saved });
    expect(mocks.saveDraft).toHaveBeenCalledWith(ownerId, draft.id, 1, {
      ...data,
      couple: { partnerOne: "Tara" },
    });
  });

  it.each([
    { ...createInput, ownerId: "e1000000-0000-4000-8000-000000000002" },
    { ...createInput, schemaVersion: 2 },
    { ...createInput, templateKey: "unregistered" },
    { ...createInput, data: { events: [{ title: "Missing stable ID" }] } },
    { ...createInput, data: { events: [{ id: "same" }, { id: "same" }] } },
    { ...createInput, data: { hosts: Array(11).fill("Host") } },
    { ...createInput, data: { couple: { partnerOne: "a".repeat(81) } } },
    { ...createInput, data: { timeZone: "Not/A_Timezone" } },
    {
      ...createInput,
      data: { events: [{ id: "date", startsAt: "2027-02-29T12:00:00Z" }] },
    },
  ])(
    "rejects invalid draft input before touching the write boundary",
    async (body) => {
      const response = await createDraft(json("POST", body));
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        error: { code: "INVALID_DRAFT" },
      });
      expect(mocks.createDraft).not.toHaveBeenCalled();
    },
  );

  it("counts payload bytes and also rejects an oversized stream without Content-Length", async () => {
    const response = await createDraft(
      json("POST", {
        ...createInput,
        data: { welcomeNote: "é".repeat(65_536) },
      }),
    );
    expect(response.status).toBe(413);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(136_000));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/drafts", {
      method: "POST",
      body: stream,
      headers: { "Content-Type": "application/json" },
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect((await createDraft(request)).status).toBe(413);
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });

  it.each([
    { data: { user: null }, error: { status: 401 } },
    {
      data: {
        user: { id: ownerId, role: "authenticated", is_anonymous: true },
      },
      error: null,
    },
  ])(
    "rejects invalid and anonymous sessions for create and save",
    async (result) => {
      mocks.getUser.mockResolvedValue(result);
      expect((await createDraft(json("POST", createInput))).status).toBe(401);
      expect(
        (await saveDraft(json("PATCH", updateInput), draft.id)).status,
      ).toBe(401);
      expect(mocks.createDraft).not.toHaveBeenCalled();
      expect(mocks.saveDraft).not.toHaveBeenCalled();
    },
  );

  it("uses the same 404 for an inaccessible or absent draft", async () => {
    mocks.loadDraft.mockResolvedValue(null);
    mocks.saveDraft.mockResolvedValue(null);
    const result = await loadDraft(draft.id);
    const patch = await saveDraft(json("PATCH", updateInput), draft.id);
    expect(result.status).toBe(404);
    expect(patch.status).toBe(404);
    expect(await result.json()).toEqual(await patch.json());
  });

  it("returns a conflict version only after a successful owner read", async () => {
    mocks.saveDraft.mockResolvedValue(null);
    mocks.loadDraft.mockResolvedValue({ ...draft, version: 3 });
    const result = await saveDraft(json("PATCH", updateInput), draft.id);
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({
      error: { code: "VERSION_CONFLICT", currentVersion: 3 },
    });
  });

  it("does not return private database error details", async () => {
    mocks.createDraft.mockRejectedValue(new Error("private database error"));
    const result = await createDraft(json("POST", createInput));
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Drafts are temporarily unavailable.",
      },
    });
  });
});
