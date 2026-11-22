import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Draft } from "@/lib/drafts/contract";
import { StudioEditor } from "./StudioEditor";

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

function edit(draft = fixture) {
  render(<StudioEditor initialDraft={draft} templateName="Afterglow" />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
