import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Draft } from "@/lib/drafts/contract";
import {
  draftMediaPath,
  MAX_PHOTO_BYTES,
  privatePhotoReference,
} from "@/lib/media/contract";
import {
  PhotoVerificationError,
  uploadPrivatePhoto,
} from "@/lib/media/upload-client";
import { StudioEditor } from "./StudioEditor";

vi.mock("@/lib/media/upload-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/media/upload-client")>()),
  uploadPrivatePhoto: vi.fn(),
}));

const upload = vi.mocked(uploadPrivatePhoto);
const originalAsset = "a1000000-0000-4000-8000-000000000001";
const replacementAsset = "a1000000-0000-4000-8000-000000000002";
const privateMediaSource = (id: string) =>
  new URL(draftMediaPath(fixture.id, id), window.location.origin).href;

const fixture: Draft = {
  id: "e1000000-0000-4000-8000-000000000001",
  templateId: "e1000000-0000-4000-8000-000000000002",
  templateKey: "afterglow",
  schemaVersion: 1,
  version: 2,
  updatedAt: "2026-11-22T09:00:00Z",
  data: {
    couple: { partnerOne: "Tara", partnerTwo: "Neel" },
    timeZone: "Asia/Kolkata",
    events: [
      {
        id: "ceremony",
        title: "Wedding",
        startsAt: "2027-12-12T17:30:30.125+05:30",
        venue: {
          name: "Garden",
          address: "Kochi",
          mapsUrl: "https://maps.example.com/location",
        },
      },
      { id: "reception", title: "Reception" },
    ],
  },
};
const response = (draft: Draft) => Response.json({ draft });
const failure = (status: number) =>
  Response.json({ error: { message: "Request failed" } }, { status });
const button = (name: string) => screen.getByRole("button", { name });
const nameField = () => screen.getByLabelText("Partner 1 name");

function edit(draft = fixture, mediaAvailable = false) {
  render(
    <StudioEditor
      initialDraft={draft}
      templateName="Afterglow"
      mediaAvailable={mediaAvailable}
    />,
  );
}

function mockLocalPhotos(decode = vi.fn().mockResolvedValue(undefined)) {
  let counter = 0;
  const createObjectURL = vi.fn(
    () => `blob:http://localhost/photo-${++counter}`,
  );
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  vi.stubGlobal(
    "Image",
    class {
      decode = decode;
      naturalWidth = 640;
      naturalHeight = 480;
    },
  );
  return { createObjectURL, revokeObjectURL };
}

function pngFile(signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) {
  const bytes = Uint8Array.from(signature);
  const file = new File([bytes], "private-name.png", { type: "image/png" });
  // JSDOM's Blob does not implement arrayBuffer.
  vi.spyOn(file, "slice").mockReturnValue({
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  } as Blob);
  return file;
}

function chooseCover(file: File) {
  fireEvent.change(screen.getByLabelText(/(?:choose|replace) cover photo/i), {
    target: { files: [file] },
  });
}

afterEach(() => {
  cleanup();
  upload.mockReset();
  vi.unstubAllGlobals();
});

describe("Studio private cover photo", () => {
  it("reuses the verified asset after a save failure and restores its description and crop after reload", async () => {
    const { revokeObjectURL } = mockLocalPhotos();
    upload.mockResolvedValue(originalAsset);
    let saved = fixture;
    const request = vi
      .fn()
      .mockResolvedValueOnce(failure(500))
      .mockImplementation((_url, init) => {
        saved = {
          ...saved,
          version: saved.version + 1,
          data: JSON.parse(init.body).data,
        };
        return Promise.resolve(response(saved));
      });
    vi.stubGlobal("fetch", request);
    edit(fixture, true);
    expect(screen.getByText("No cover photo")).toBeVisible();
    chooseCover(pngFile());
    const image = await screen.findByAltText("Wedding cover photograph");
    expect(image).toHaveAttribute("src", privateMediaSource(originalAsset));
    expect(image).not.toHaveAttribute("srcset");
    fireEvent.load(image);
    await waitFor(() => expect(image).toBeVisible());
    fireEvent.change(screen.getByLabelText("Photo description"), {
      target: { value: "Tara and Neel in a garden" },
    });
    fireEvent.change(screen.getByLabelText("Horizontal crop position"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Vertical crop position"), {
      target: { value: "75" },
    });
    expect(image).toHaveStyle({ objectPosition: "25% 75%" });
    fireEvent.click(button("Preview invitation"));
    expect(screen.getByAltText("Tara and Neel in a garden")).toHaveStyle({
      objectPosition: "25% 75%",
    });
    expect(
      screen.getByRole("complementary", { name: "Demo preview" }),
    ).toBeInTheDocument();
    fireEvent.click(button("Back to editor"));
    expect(button("Preview invitation")).toHaveFocus();
    fireEvent.click(button("Save draft"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "couldn’t confirm the save",
    );
    expect(screen.getByLabelText("Horizontal crop position")).toHaveValue("25");
    fireEvent.click(button("Save draft"));
    expect(await screen.findByText("Draft saved.")).toBeVisible();
    for (const [, init] of request.mock.calls) {
      const { data } = JSON.parse(init.body);
      expect(data.coverImage).toEqual({
        src: privatePhotoReference(originalAsset),
        alt: "Tara and Neel in a garden",
        focalPosition: { x: 0.25, y: 0.75 },
      });
      expect(init.body).not.toMatch(/blob:|private-name|X-Amz-/);
    }
    expect(upload).toHaveBeenCalledTimes(1);
    cleanup();
    edit(saved, true);
    expect(screen.getByLabelText("Horizontal crop position")).toHaveValue("25");
    expect(screen.getByAltText("Tara and Neel in a garden")).toHaveStyle({
      objectPosition: "25% 75%",
    });
    fireEvent.click(button("Center photo"));
    expect(screen.getByAltText("Tara and Neel in a garden")).toHaveStyle({
      objectPosition: "50% 50%",
    });
    fireEvent.click(button("Remove cover photo"));
    expect(screen.getByLabelText("Choose cover photo")).toHaveFocus();
    expect(screen.getByText("No cover photo")).toBeVisible();
    fireEvent.click(button("Save draft"));
    expect(await screen.findByText("Draft saved.")).toBeVisible();
    expect(saved.data).not.toHaveProperty("coverImage");
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/photo-1",
    );
  });

  it("rejects invalid files before upload and retains the old cover through replacement retries", async () => {
    const decode = vi.fn().mockResolvedValue(undefined);
    const { createObjectURL, revokeObjectURL } = mockLocalPhotos(decode);
    upload
      .mockResolvedValueOnce(originalAsset)
      .mockRejectedValueOnce(new Error("Upload failed."))
      .mockRejectedValueOnce(
        new PhotoVerificationError("Verification failed.", replacementAsset),
      )
      .mockResolvedValueOnce(replacementAsset);
    edit(fixture, true);
    chooseCover(new File(["document"], "photo.png", { type: "text/plain" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a JPEG, PNG, or WebP image.",
    );
    chooseCover(
      new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "large.png", {
        type: "image/png",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("up to 5 MiB");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    chooseCover(pngFile());
    await screen.findByAltText("Wedding cover photograph");
    chooseCover(pngFile([0x00, 0x01]));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn’t open");
    expect(decode).toHaveBeenCalledTimes(1);
    decode.mockRejectedValueOnce(new Error("Invalid image data"));
    chooseCover(pngFile());
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn’t open");
    expect(screen.getByAltText("Wedding cover photograph")).toHaveAttribute(
      "src",
      privateMediaSource(originalAsset),
    );
    expect(upload).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/photo-2",
    );
    const retryFile = pngFile();
    chooseCover(retryFile);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Upload failed.",
    );
    expect(screen.getByAltText("Wedding cover photograph")).toHaveAttribute(
      "src",
      privateMediaSource(originalAsset),
    );
    fireEvent.click(button("Retry photo upload"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verification failed.",
    );
    fireEvent.click(button("Retry photo verification"));
    await waitFor(() =>
      expect(screen.getByAltText("Wedding cover photograph")).toHaveAttribute(
        "src",
        privateMediaSource(replacementAsset),
      ),
    );
    expect(upload.mock.calls[3][1]).toBe(retryFile);
    expect(upload.mock.calls[3][4]).toBe(replacementAsset);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cancels a pending upload, ignores late completion, and prevents duplicate submissions", async () => {
    const result = Promise.withResolvers<string>();
    const { revokeObjectURL } = mockLocalPhotos();
    upload
      .mockReturnValueOnce(result.promise)
      .mockResolvedValueOnce(replacementAsset);
    edit(fixture, true);
    chooseCover(pngFile());
    await screen.findByRole("progressbar", {
      name: "Cover photo upload progress",
    });
    expect(screen.getByAltText("Selected cover photograph")).toHaveAttribute(
      "src",
      "blob:http://localhost/photo-1",
    );
    expect(screen.getByLabelText("Choose cover photo")).toBeDisabled();
    chooseCover(pngFile());
    expect(upload).toHaveBeenCalledTimes(1);
    fireEvent.click(button("Cancel upload"));
    expect(upload.mock.calls[0][2].aborted).toBe(true);
    await act(async () => result.resolve(originalAsset));
    expect(await screen.findByText("Upload cancelled.")).toBeVisible();
    expect(screen.getByText("No cover photo")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("Choose cover photo")).toHaveFocus(),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:http://localhost/photo-1",
    );
    chooseCover(pngFile());
    expect(
      await screen.findByAltText("Wedding cover photograph"),
    ).toHaveAttribute("src", privateMediaSource(replacementAsset));
  });
});

describe("Studio draft editor", () => {
  it("loads real draft values, sends a full replacement, waits for confirmation and uses the new version", async () => {
    let finish!: (result: Response) => void;
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(response({ ...fixture, version: 4 })),
      );
    vi.stubGlobal("fetch", request);
    edit();
    expect(nameField()).toHaveValue("Tara");
    expect(screen.getAllByLabelText("Date and time")[0]).toHaveValue(
      "2027-12-12T17:30",
    );
    fireEvent.change(nameField(), { target: { value: "Asha" } });
    fireEvent.click(button("Remove ceremony 2"));
    fireEvent.change(screen.getByLabelText("Venue name"), {
      target: { value: "New garden" },
    });
    expect(screen.getByLabelText("Map link")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    fireEvent.click(button("Save draft"));
    expect(screen.getByRole("status")).toHaveTextContent("Saving draft");
    expect(button("Save draft")).toBeDisabled();
    const [url, init] = request.mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(url).toBe(`/api/drafts/${fixture.id}`);
    expect(init.method).toBe("PUT");
    expect(sent.expectedVersion).toBe(2);
    expect(sent.data.couple.partnerOne).toBe("Asha");
    expect(sent.data.events).toHaveLength(1);
    expect(sent.data.events[0].startsAt).toBe(
      fixture.data.events?.[0].startsAt,
    );
    expect(sent.data.events[0].venue).toEqual({
      name: "New garden",
      address: "Kochi",
    });
    finish(response({ ...fixture, version: 3, data: sent.data }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Draft saved"),
    );
    fireEvent.click(button("Save draft"));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Draft saved"),
    );
    expect(JSON.parse(request.mock.calls[1][1].body).expectedVersion).toBe(3);
  });

  it("saves incomplete data, including a newly added ceremony with a stable ID", async () => {
    const initial = { ...fixture, data: {} };
    const request = vi.fn().mockImplementation((_url, init) =>
      Promise.resolve(
        response({
          ...initial,
          version: 3,
          data: JSON.parse(init.body).data,
        }),
      ),
    );
    vi.stubGlobal("fetch", request);
    edit(initial);
    fireEvent.change(nameField(), { target: { value: "Asha" } });
    fireEvent.click(button("Add ceremony"));
    expect(screen.getByLabelText("Ceremony name")).toHaveFocus();
    fireEvent.click(button("Save draft"));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Draft saved"),
    );
    const { data } = JSON.parse(request.mock.calls[0][1].body);
    expect(data.couple).toEqual({ partnerOne: "Asha" });
    expect(data.events).toEqual([{ id: expect.any(String) }]);
    fireEvent.click(button("Preview invitation"));
    expect(screen.getByText(/You can save your draft before/)).toBeVisible();
  });

  it("requires explicit discard before loading a newer version and never retries a stale snapshot", async () => {
    const latest = {
      ...fixture,
      version: 3,
      data: {
        ...fixture.data,
        couple: { partnerOne: "Latest", partnerTwo: "Neel" },
      },
    };
    const request = vi
      .fn()
      .mockResolvedValueOnce(failure(409))
      .mockResolvedValueOnce(response(latest));
    vi.stubGlobal("fetch", request);
    edit();
    fireEvent.change(nameField(), { target: { value: "My changes" } });
    fireEvent.click(button("Save draft"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "changed in another session",
    );
    expect(nameField()).toHaveValue("My changes");
    expect(button("Save draft")).toBeDisabled();
    fireEvent.click(button("Load latest saved copy"));
    expect(
      screen.getByText(
        "Loading the latest copy will discard these unsaved edits.",
      ),
    ).toBeVisible();
    fireEvent.click(button("Keep editing"));
    expect(request).toHaveBeenCalledTimes(1);
    expect(nameField()).toHaveValue("My changes");
    fireEvent.click(button("Load latest saved copy"));
    fireEvent.click(button("Discard edits and reload"));
    await waitFor(() => expect(nameField()).toHaveValue("Latest"));
    expect(request.mock.calls[1][1]).not.toHaveProperty("method");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Latest saved draft loaded",
    );
  });

  it.each([
    [500, "couldn’t confirm the save"],
    [401, "session has ended"],
    [404, "draft is unavailable"],
    [413, "draft is too large"],
  ])("reports status %i without losing input", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failure(status)));
    edit();
    fireEvent.change(nameField(), { target: { value: "Unsaved" } });
    fireEvent.click(button("Save draft"));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(nameField()).toHaveValue("Unsaved");
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  });

  it("links client and server validation messages to their fields", async () => {
    const request = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            issues: [
              { path: "data.couple.partnerOne", message: "Use valid text." },
            ],
          },
        },
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", request);
    edit();
    const map = screen.getAllByLabelText("Map link")[0];
    fireEvent.change(map, {
      target: { value: "https://user:password@maps.example.com/" },
    });
    fireEvent.click(button("Save draft"));
    expect(map).toHaveAttribute("aria-invalid", "true");
    expect(map).toHaveAccessibleDescription(
      /must use HTTP\/HTTPS without credentials/,
    );
    expect(request).not.toHaveBeenCalled();
    fireEvent.change(map, { target: { value: "" } });
    fireEvent.click(button("Save draft"));
    await waitFor(() =>
      expect(nameField()).toHaveAccessibleDescription("Use valid text."),
    );
  });

  it("preserves a valid untouched hosts list when another field changes", async () => {
    const hosts = ["The families of Tara\nand Neel", "Asha"];
    const request = vi.fn().mockImplementation((_url, init) =>
      Promise.resolve(
        response({
          ...fixture,
          version: 3,
          data: JSON.parse(init.body).data,
        }),
      ),
    );
    vi.stubGlobal("fetch", request);
    edit({ ...fixture, data: { ...fixture.data, hosts } });
    fireEvent.change(nameField(), { target: { value: "Tara edited" } });
    fireEvent.click(button("Save draft"));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Draft saved"),
    );
    expect(JSON.parse(request.mock.calls[0][1].body).data.hosts).toEqual(hosts);
    fireEvent.change(screen.getByLabelText("Hosts"), { target: { value: "" } });
    fireEvent.click(button("Save draft"));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(JSON.parse(request.mock.calls[1][1].body).data).not.toHaveProperty(
      "hosts",
    );
  });

  it("does not announce that all changes are saved after an unchanged draft save fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failure(500)));
    edit();
    expect(screen.getByRole("status")).toHaveTextContent("All changes saved");
    fireEvent.click(button("Save draft"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "couldn’t confirm the save",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "All changes saved",
    );
    expect(nameField()).toHaveValue("Tara");
  });

  it("blocks a partially entered native date without treating it as a cleared value", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(response({ ...fixture, version: 3 }));
    vi.stubGlobal("fetch", request);
    edit();
    const date = screen.getAllByLabelText(
      "Date and time",
    )[0] as HTMLInputElement;
    fireEvent.change(date, { target: { value: "" } });
    const nativeState = { badInput: true };
    // Chromium reports an empty value with badInput=true while date parts are incomplete.
    Object.defineProperty(date, "validity", { value: nativeState });

    fireEvent.click(button("Save draft"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Complete the ceremony date and time",
    );
    expect(date).toHaveAccessibleDescription(
      /Complete the ceremony date and time/,
    );
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(button("Preview invitation"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fix the highlighted details before previewing",
    );

    nativeState.badInput = false;
    fireEvent.click(button("Save draft"));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Draft saved"),
    );
    expect(
      JSON.parse(request.mock.calls[0][1].body).data.events[0],
    ).not.toHaveProperty("startsAt");
  });

  it("keeps edits and allows retry when loading a newer copy fails", async () => {
    const latest = { ...fixture, version: 3 };
    const request = vi
      .fn()
      .mockResolvedValueOnce(failure(409))
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(response(latest));
    vi.stubGlobal("fetch", request);
    edit();
    fireEvent.change(nameField(), { target: { value: "Local unsaved" } });
    fireEvent.click(button("Save draft"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "changed in another session",
    );
    fireEvent.click(button("Load latest saved copy"));
    fireEvent.click(button("Discard edits and reload"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "couldn’t load the latest saved copy",
      ),
    );
    expect(nameField()).toHaveValue("Local unsaved");
    expect(button("Save draft")).toBeDisabled();
    fireEvent.click(button("Discard edits and reload"));
    await waitFor(() => expect(nameField()).toHaveValue("Tara"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Latest saved draft loaded",
    );
  });

  it("previews the actual renderer with a watermark and preserves editor state on return", () => {
    edit();
    fireEvent.change(nameField(), { target: { value: "Asha" } });
    fireEvent.click(button("Preview invitation"));
    expect(
      screen.getByRole("complementary", { name: "Demo preview" }),
    ).toHaveTextContent("YUGMA • DEMO");
    expect(
      within(screen.getByRole("main")).getByRole("heading", {
        name: /Asha.*Neel/,
      }),
    ).toBeVisible();
    expect(screen.getByText(/Incomplete ceremonies are hidden/)).toBeVisible();
    fireEvent.click(button("Back to editor"));
    expect(nameField()).toHaveValue("Asha");
    expect(button("Preview invitation")).toHaveFocus();
  });
});
