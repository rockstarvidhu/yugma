// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, PUT } from "@/app/api/drafts/[id]/route";
import type { Draft } from "./contract";
import { createDraft, listDrafts, loadDraft, saveDraft } from "./http";

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  getUser: vi.fn(),
  createDraft: vi.fn(),
  listDrafts: vi.fn(),
  loadDraft: vi.fn(),
  saveDraft: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/auth/client", () => ({
  createAuthClient: mocks.createAuthClient,
  getSupabaseConfig: () => ({}),
}));
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
const context = { params: Promise.resolve({ id: draft.id }) };

function json(method: string, body: unknown) {
  return new Request("http://localhost/api/drafts", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createAuthClient.mockReturnValue(client);
  mocks.loadDraft.mockResolvedValue(draft);
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

  it.each([
    ["NUL", "Tara\u0000Neel"],
    ["unpaired high surrogate", "Tara\uD800"],
    ["unpaired low surrogate", "\uDC00Neel"],
  ])("rejects %s before creating or saving a draft", async (_name, note) => {
    const stored = { ...draft, data: { welcomeNote: "Original invitation" } };
    mocks.loadDraft.mockResolvedValue(stored);
    const data = { events: [{ id: "ceremony", description: note }] };
    const post = await createDraft(json("POST", { ...createInput, data }));
    const patch = await saveDraft(
      json("PATCH", { ...updateInput, data }),
      draft.id,
    );

    expect(post.status).toBe(422);
    expect(patch.status).toBe(400);
    for (const response of [post, patch]) {
      expect(await response.json()).toMatchObject({
        error: {
          code: "INVALID_DRAFT",
          issues: [{ path: "data.events.0.description" }],
        },
      });
    }
    expect(mocks.createDraft).not.toHaveBeenCalled();
    expect(mocks.saveDraft).not.toHaveBeenCalled();
    expect(await (await loadDraft(draft.id)).json()).toEqual({ draft: stored });
  });

  it("passes valid Unicode and emoji to both write operations", async () => {
    const data = { welcomeNote: "नमस्ते 🌸", couple: { partnerOne: "José" } };
    mocks.createDraft.mockResolvedValue({ ...draft, data });
    mocks.saveDraft.mockResolvedValue({ ...draft, data, version: 2 });

    expect(
      (await createDraft(json("POST", { ...createInput, data }))).status,
    ).toBe(201);
    expect(
      (await saveDraft(json("PATCH", { ...updateInput, data }), draft.id))
        .status,
    ).toBe(200);
    expect(mocks.createDraft).toHaveBeenCalledWith(ownerId, "afterglow", data);
    expect(mocks.saveDraft).toHaveBeenCalledWith(ownerId, draft.id, 1, data);
  });

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
    const otherOwnerId = "e1000000-0000-4000-8000-000000000002";
    mocks.getUser.mockResolvedValue({
      data: { user: { id: otherOwnerId, role: "authenticated" } },
      error: null,
    });
    mocks.loadDraft.mockResolvedValue(null);
    const result = await GET(
      new Request("http://localhost/api/drafts"),
      context,
    );
    const patch = await PATCH(json("PATCH", updateInput), context);
    const put = await PUT(json("PUT", updateInput), context);
    expect(result.status).toBe(404);
    expect(patch.status).toBe(404);
    expect(put.status).toBe(404);
    const error = await result.json();
    expect(await patch.json()).toEqual(error);
    expect(await put.json()).toEqual(error);
    expect(error).toEqual({
      error: { code: "DRAFT_NOT_FOUND", message: "Draft not found." },
    });
    expect(mocks.loadDraft).toHaveBeenCalledWith(
      { client, ownerId: otherOwnerId },
      draft.id,
    );
    expect(mocks.saveDraft).not.toHaveBeenCalled();
  });

  it("returns a conflict version only after a successful owner read", async () => {
    mocks.saveDraft.mockResolvedValue(null);
    mocks.loadDraft.mockResolvedValue({ ...draft, version: 3 });
    const result = await saveDraft(json("PATCH", updateInput), draft.id);
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({
      error: { code: "VERSION_CONFLICT", currentVersion: 3 },
    });
    expect(mocks.saveDraft).not.toHaveBeenCalled();
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

describe("versioned updates on the draft detail route", () => {
  const savedData: Draft["data"] = {
    couple: { partnerOne: "Tara", partnerTwo: "Neel" },
    timeZone: "Europe/London",
    welcomeNote: "Sample welcome",
    events: [
      {
        id: "ceremony",
        title: "Ceremony",
        startsAt: "2026-10-25T01:15:00+01:00",
        venue: { name: "Sample Hall", address: "Sample Lane" },
      },
      {
        id: "reception",
        startsAt: "2026-10-25T01:15:00Z",
        venue: { address: "Other Sample Lane" },
      },
    ],
  };

  function useDraftStorage(data: Draft["data"]) {
    let current = { ...draft, data };
    mocks.loadDraft.mockImplementation(async () => current);
    mocks.saveDraft.mockImplementation(
      async (
        _owner: string,
        _id: string,
        expectedVersion: number,
        next: Draft["data"],
      ) => {
        if (current.version !== expectedVersion) return null;
        current = {
          ...current,
          data: next,
          version: current.version + 1,
          updatedAt: "2026-11-22T10:00:00Z",
        };
        return current;
      },
    );
  }

  it("merges by event ID and preserves omitted fields and ceremonies on reload", async () => {
    useDraftStorage(savedData);
    const response = await PATCH(
      json("PATCH", {
        ...updateInput,
        data: {
          couple: { partnerTwo: "Ravi" },
          welcomeNote: " ",
          events: [
            { id: "ceremony", venue: { name: "Updated Hall" } },
            { id: "brunch" },
          ],
        },
      }),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const expected = {
      ...draft,
      version: 2,
      updatedAt: "2026-11-22T10:00:00Z",
      data: {
        couple: { partnerOne: "Tara", partnerTwo: "Ravi" },
        timeZone: "Europe/London",
        events: [
          {
            ...savedData.events?.[0],
            venue: { name: "Updated Hall", address: "Sample Lane" },
          },
          savedData.events?.[1],
          { id: "brunch" },
        ],
      },
    };
    expect(await response.json()).toEqual({ draft: expected });
    const reload = await GET(
      new Request("http://localhost/api/drafts"),
      context,
    );
    expect(await reload.json()).toEqual({ draft: expected });
  });

  it("clears the event list explicitly and replaces all content with PUT", async () => {
    useDraftStorage(savedData);
    const clear = await PATCH(
      json("PATCH", {
        ...updateInput,
        data: { events: [] },
      }),
      context,
    );
    expect(await clear.json()).toMatchObject({
      draft: { data: { ...savedData, events: [] }, version: 2 },
    });
    const data = { couple: { partnerOne: "Tara" } };
    const response = await PUT(
      json("PUT", { ...updateInput, expectedVersion: 2, data }),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      draft: { ...draft, updatedAt: "2026-11-22T10:00:00Z", version: 3, data },
    });
  });

  it.each([
    { owner_id: "different-owner" },
    { status: "paid" },
    { status: "published" },
    { paymentStatus: "captured" },
    { publishedAt: "2026-11-21T16:00:00Z", shareSlug: "sample" },
    {
      updated_at: "2026-11-22T10:00:00Z",
      version: 9,
      templateId: draft.templateId,
    },
    { data: { unexpected: true } },
    { data: { events: [{ id: "ceremony", venue: { owner_id: "other" } }] } },
    {
      data: {
        coverImage: {
          src: "https://example.com/a.jpg",
          alt: "Example",
          focalPosition: { x: 0.5, y: 0.5, status: "published" },
        },
      },
    },
    { data: { timeZone: "+05:30" } },
    { data: { events: [{ id: "ceremony", startsAt: "2026-11-21T16:00:00" }] } },
    { data: { events: [{ id: "ceremony" }, { id: " ceremony " }] } },
    {
      data: {
        events: [{ id: "ceremony", venue: { mapsUrl: "javascript:alert(1)" } }],
      },
    },
    { data: { couple: { partnerOne: " " } } },
    { data: { welcomeNote: null } },
  ])(
    "rejects invalid or privileged payload %j with 400 for both methods",
    async (input) => {
      for (const [method, handler] of [
        ["PATCH", PATCH],
        ["PUT", PUT],
      ] as const) {
        const response = await handler(
          json(method, { ...updateInput, ...input }),
          context,
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          error: { code: "INVALID_DRAFT" },
        });
      }
      expect(mocks.saveDraft).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed JSON and enforces limits on the merged draft", async () => {
    const malformed = new Request("http://localhost/api/drafts", {
      method: "PATCH",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    expect((await PATCH(malformed, context)).status).toBe(400);

    useDraftStorage({
      events: Array.from({ length: 5 }, (_, i) => ({ id: String(i) })),
    });
    const tooManyEvents = await PATCH(
      json("PATCH", {
        ...updateInput,
        data: { events: [{ id: "another-event" }] },
      }),
      context,
    );
    expect(tooManyEvents.status).toBe(400);
    expect(await tooManyEvents.json()).toMatchObject({
      error: { issues: [{ path: "data.events" }] },
    });

    const image = {
      src: `https://example.com/${"界".repeat(1950)}`,
      alt: "界".repeat(180),
    };
    useDraftStorage({ gallery: Array.from({ length: 20 }, () => image) });
    const tooLarge = await PATCH(
      json("PATCH", {
        ...updateInput,
        data: { coverImage: image },
      }),
      context,
    );
    expect(tooLarge.status).toBe(413);
    expect(mocks.saveDraft).not.toHaveBeenCalled();
  });

  it("allows exactly one of two concurrent saves and lets the other client reload and retry", async () => {
    useDraftStorage(savedData);
    const open = () => GET(new Request("http://localhost/api/drafts"), context);
    const [clientA, clientB] = await Promise.all([
      open().then((response) => response.json()),
      open().then((response) => response.json()),
    ]);
    expect([clientA.draft.version, clientB.draft.version]).toEqual([1, 1]);
    const current = { ...draft, data: savedData };
    const bothRead = Promise.withResolvers<void>();
    mocks.loadDraft
      .mockImplementationOnce(async () => {
        await bothRead.promise;
        return current;
      })
      .mockImplementationOnce(async () => {
        bothRead.resolve();
        return current;
      });

    const save = (welcomeNote: string, expectedVersion: number) =>
      PATCH(
        json("PATCH", {
          ...updateInput,
          expectedVersion,
          data: { welcomeNote },
        }),
        context,
      );
    const responses = await Promise.all([
      save("Client A", clientA.draft.version),
      save("Client B", clientB.draft.version),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(mocks.saveDraft).toHaveBeenCalledTimes(2);
    const winner = await responses.find((response) => response.ok)?.json();
    const conflict = await responses
      .find((response) => response.status === 409)
      ?.json();
    expect(conflict).toMatchObject({
      error: { code: "VERSION_CONFLICT", currentVersion: 2 },
    });
    expect(await (await open()).json()).toEqual(winner);

    const retry = await save("Reviewed retry", winner.draft.version);
    expect(await retry.json()).toMatchObject({
      draft: {
        version: 3,
        data: { ...savedData, welcomeNote: "Reviewed retry" },
      },
    });
  });
});
