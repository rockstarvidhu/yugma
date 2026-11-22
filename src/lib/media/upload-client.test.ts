// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { uploadPrivatePhoto } from "./upload-client";

const assetId = "a1000000-0000-4000-8000-000000000001";
const draftId = "a2000000-0000-4000-8000-000000000001";
const file = new File(["image fixture"], "cover.png", { type: "image/png" });

class PutTransport {
  static status = 200;
  static onSend: (() => void) | undefined;
  status = 0;
  onload?: () => void;
  onabort?: () => void;
  onloadend?: () => void;
  upload: {
    onprogress?: (event: {
      loaded: number;
      total: number;
      lengthComputable: boolean;
    }) => void;
  } = {};

  open = vi.fn();
  setRequestHeader = vi.fn();

  send() {
    if (PutTransport.onSend) {
      PutTransport.onSend();
      return;
    }
    this.upload.onprogress?.({ loaded: 2, total: 4, lengthComputable: true });
    this.status = PutTransport.status;
    this.onload?.();
    this.onloadend?.();
  }

  abort() {
    this.onabort?.();
    this.onloadend?.();
  }
}

function prepare() {
  const fetch = vi.fn().mockResolvedValueOnce(
    Response.json(
      {
        assetId,
        uploadUrl: "https://storage.example/fictional-upload-ticket",
      },
      { status: 201 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("XMLHttpRequest", PutTransport);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  PutTransport.onSend = undefined;
  PutTransport.status = 200;
});

it("reports transfer progress and waits for successful server completion", async () => {
  const fetch = prepare();
  fetch.mockResolvedValueOnce(Response.json({ assetId }));
  const signal = new AbortController().signal;
  const progress = vi.fn();

  expect(await uploadPrivatePhoto(draftId, file, signal, progress)).toBe(
    assetId,
  );
  expect(progress.mock.calls).toEqual([[50], ["verifying"]]);
  expect(fetch).toHaveBeenLastCalledWith(
    "/api/drafts/" + draftId + "/media/" + assetId,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal,
    },
  );
});

it("does not request completion when the PUT fails", async () => {
  const fetch = prepare();
  PutTransport.status = 503;
  await expect(
    uploadPrivatePhoto(draftId, file, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("upload failed");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("cancels the actual transfer without requesting completion", async () => {
  const fetch = prepare();
  const controller = new AbortController();
  PutTransport.onSend = () => controller.abort();
  await expect(
    uploadPrivatePhoto(draftId, file, controller.signal, vi.fn()),
  ).rejects.toHaveProperty("name", "AbortError");
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("surfaces verification failure without returning an asset ID", async () => {
  const fetch = prepare();
  fetch.mockResolvedValueOnce(
    Response.json({ message: "Photo verification failed." }, { status: 422 }),
  );
  await expect(
    uploadPrivatePhoto(draftId, file, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("Photo verification failed.");
});
