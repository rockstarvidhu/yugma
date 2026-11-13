import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HeirloomDemo from "@/app/demo/heirloom/page";
import { PreviewShell } from "@/components/preview/PreviewShell";
import { invitationSchema } from "@/lib/invitation-schema";
import { previewFields, validatePreview } from "@/lib/preview-invitation";
import { shellDemoInvitation } from "@/templates/internal/demo-invitation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const heading = () => screen.getByRole("heading", { level: 1 });
const watermark = () =>
  screen.getByRole("complementary", { name: "Demo preview" });
const start = () =>
  fireEvent.click(screen.getByRole("button", { name: "Try Your Details" }));
const apply = () =>
  fireEvent.click(screen.getByRole("button", { name: "Apply to Preview" }));
const edit = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("personalized demo", () => {
  it("renders the watermarked sample immediately and opens the optional form", () => {
    render(<HeirloomDemo />);
    const mark = watermark();
    expect(heading()).toHaveTextContent("Tara & Neel");
    expect(mark).toHaveTextContent("YUGMA • DEMO");
    expect(mark).toHaveTextContent("Sample invitation");
    expect(screen.queryByRole("form")).toBeNull();
    start();
    expect(
      screen.getByRole("form", { name: "Your invitation details" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Partner 1 name")).toHaveValue("Tara");
    expect(heading()).toHaveTextContent("Tara & Neel");
    expect(watermark()).toBe(mark);
  });

  it("applies names, note, venue and a wall-clock celebration time, then restores the complete sample", () => {
    render(<HeirloomDemo />);
    const mark = watermark();
    start();
    edit("Partner 1 name", "Devika");
    edit("Partner 2 name", "Mihir");
    edit("Welcome message (optional)", "Celebrate a new chapter with us.");
    edit("Celebration date", "2028-02-29");
    edit("Celebration time", "00:15");
    edit("Venue name", "Moon Garden");
    edit("Venue address", "12 River Road");
    apply();

    expect(heading()).toHaveTextContent("Devika & Mihir");
    expect(
      within(screen.getByRole("region", { name: "A note from us" })).getByText(
        "Celebrate a new chapter with us.",
      ),
    ).toBeVisible();
    const timeline = screen.getByRole("region", { name: "Celebrate with us" });
    expect(timeline.querySelector("time")).toHaveAttribute(
      "datetime",
      "2028-02-28T18:45:00.000Z",
    );
    expect(within(timeline).getByText(/29 February 2028/)).toBeVisible();
    expect(within(timeline).getByText("12:15 am")).toBeVisible();
    const venues = within(
      screen.getByRole("region", { name: "Wedding venues" }),
    );
    expect(venues.getByText("Moon Garden")).toBeVisible();
    expect(venues.getByText("12 River Road")).toBeVisible();
    expect(venues.queryByRole("link", { name: /Get Directions/ })).toBeNull();
    expect(watermark()).toBe(mark);
    expect(mark).toHaveTextContent("Personalized preview");

    fireEvent.click(screen.getByRole("button", { name: "Reset to Sample" }));
    expect(heading()).toHaveTextContent("Tara & Neel");
    expect(screen.getByText(shellDemoInvitation.welcomeNote!)).toBeVisible();
    expect(
      screen.getByText(shellDemoInvitation.events[0].venue.address),
    ).toBeVisible();
    expect(timeline.querySelector("time")).toHaveAttribute(
      "datetime",
      shellDemoInvitation.events[0].startsAt,
    );
    expect(venues.getByRole("link", { name: /Get Directions/ })).toBeVisible();
    expect(mark).toHaveTextContent("Sample invitation");
    expect(watermark()).toBe(mark);
    start();
    expect(screen.getByLabelText("Partner 1 name")).toHaveValue("Tara");
  });

  it("associates validation errors with their fields and keeps the last valid watermarked invitation", () => {
    render(<HeirloomDemo />);
    start();
    edit("Partner 1 name", "Anya");
    apply();
    edit("Partner 1 name", "   ");
    edit("Venue address", "");
    edit("Celebration time", "");
    apply();

    const name = screen.getByLabelText("Partner 1 name");
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Partner name is required.");
    expect(screen.getByLabelText("Venue address")).toHaveAccessibleDescription(
      "Venue address is required.",
    );
    expect(
      screen.getByLabelText("Celebration time"),
    ).toHaveAccessibleDescription("Enter a valid celebration time.");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(heading()).toHaveTextContent("Anya & Neel");
    expect(watermark()).toHaveTextContent("Personalized preview");
  });

  it("commits error descriptions before focusing the first invalid field on every submission", () => {
    render(<HeirloomDemo />);
    start();
    const name = screen.getByLabelText("Partner 1 name");
    const address = screen.getByLabelText("Venue address");
    const submit = screen.getByRole("button", { name: "Apply to Preview" });
    const focusEvents: {
      field: HTMLElement;
      invalid: string | null;
      text: string | null;
      visible: boolean;
    }[] = [];
    for (const field of [name, address]) {
      field.addEventListener("focus", () => {
        const descriptionId = field.getAttribute("aria-describedby");
        const message = descriptionId
          ? document.getElementById(descriptionId)
          : null;
        focusEvents.push({
          field,
          invalid: field.getAttribute("aria-invalid"),
          text: message?.textContent ?? null,
          visible:
            !!message &&
            !message.hidden &&
            getComputedStyle(message).display !== "none",
        });
      });
    }
    edit("Partner 1 name", "");
    edit("Venue address", "");

    for (let attempt = 0; attempt < 2; attempt++) {
      submit.focus();
      apply();
    }
    expect(focusEvents).toEqual(
      Array.from({ length: 2 }, () => ({
        field: name,
        invalid: "true",
        text: "Partner name is required.",
        visible: true,
      })),
    );

    edit("Partner 1 name", " ");
    expect(name).toHaveAttribute("aria-invalid", "true");
    edit("Partner 1 name", "Devika");
    expect(name).not.toHaveAttribute("aria-invalid");
    expect(name).not.toHaveAttribute("aria-describedby");
    expect(name).toHaveFocus();
    expect(focusEvents).toHaveLength(2);

    submit.focus();
    apply();
    expect(focusEvents.at(-1)).toEqual({
      field: address,
      invalid: "true",
      text: "Venue address is required.",
      visible: true,
    });
    expect(heading()).toHaveTextContent("Tara & Neel");

    edit("Venue address", "12 River Road");
    expect(address).not.toHaveAttribute("aria-invalid");
    expect(address).not.toHaveAttribute("aria-describedby");
    expect(address).toHaveFocus();
    expect(focusEvents).toHaveLength(3);
    submit.focus();
    apply();
    expect(submit).toHaveFocus();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(heading()).toHaveTextContent("Devika & Neel");
    expect(watermark()).toHaveTextContent("Personalized preview");
  });

  it("keeps draft and applied details out of storage and URLs and starts fresh after a remount", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const location = window.location.href;
    const cookies = document.cookie;
    const { unmount } = render(<HeirloomDemo />);
    start();
    edit("Partner 1 name", "Ephemeral");
    apply();
    expect(heading()).toHaveTextContent("Ephemeral & Neel");
    fireEvent.click(screen.getByRole("button", { name: "View Sample" }));
    expect(heading()).toHaveTextContent("Tara & Neel");
    expect(watermark()).toHaveTextContent("Sample invitation");
    start();
    edit("Partner 1 name", "Ephemeral");
    apply();
    expect(storage).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookies);
    expect(window.location.href).toBe(location);
    unmount();
    render(<HeirloomDemo />);
    expect(heading()).toHaveTextContent("Tara & Neel");
    expect(watermark()).toHaveTextContent("Sample invitation");
  });

  it("edits one ceremony while preserving another and leaving the frozen fixture intact", () => {
    const event = shellDemoInvitation.events[0];
    const sample = invitationSchema.parse({
      ...shellDemoInvitation,
      events: [
        { ...event, location: "Original entrance" },
        {
          ...event,
          id: "dinner",
          title: "Family dinner",
          startsAt: "2027-12-14T12:00:47Z",
          location: "East door",
          description: "Meet the families",
          dressCode: "Festive",
          venue: {
            name: "River Hall",
            address: "River Road",
            mapsUrl: "https://maps.example.com/dinner",
          },
        },
      ],
    });
    for (const item of sample.events) {
      Object.freeze(item.venue);
      Object.freeze(item);
    }
    Object.freeze(sample.events);
    Object.freeze(sample.couple);
    Object.freeze(sample);
    const before = JSON.stringify(sample);
    render(<PreviewShell sample={sample} templateId="afterglow" />);
    start();
    const first = within(
      screen.getByRole("group", { name: "Wedding celebration" }),
    );
    fireEvent.change(first.getByLabelText("Venue name"), {
      target: { value: "New Garden" },
    });
    apply();
    expect(screen.getByText("New Garden")).toBeVisible();
    expect(screen.getByText("Meet the families")).toBeVisible();
    expect(screen.getByText(/Festive/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Get Directions to River Hall/ }),
    ).toHaveAttribute("href", "https://maps.example.com/dinner");
    const fields = previewFields(sample);
    fields.events[0].venueName = "New Garden";
    const result = validatePreview(sample, fields).invitation!;
    expect(result.events[0].id).toBe(event.id);
    expect(result.events[0].venue.mapsUrl).toBeUndefined();
    expect(result.events[0].location).toBeUndefined();
    expect(screen.queryByText(/Original entrance/)).toBeNull();
    expect(result.events[1]).toEqual(sample.events[1]);
    expect(JSON.stringify(sample)).toBe(before);
  });
});

describe("preview time validation", () => {
  const ny = invitationSchema.parse({
    ...shellDemoInvitation,
    timeZone: "America/New_York",
  });
  it("rejects nonexistent daylight-saving times and invalid calendar dates", () => {
    const fields = previewFields(ny);
    Object.assign(fields.events[0], { date: "2028-03-12", time: "02:30" });
    expect(validatePreview(ny, fields).errors?.["events.0.time"]).toMatch(
      /does not exist/,
    );
    fields.events[0].date = "2027-02-29";
    expect(validatePreview(ny, fields).errors?.["events.0.date"]).toBeDefined();
  });
  it("resolves a new repeated wall time to the earlier instant and normalizes blank welcome text", () => {
    const fields = previewFields(ny);
    fields.welcomeNote = " ";
    Object.assign(fields.events[0], { date: "2028-11-05", time: "01:30" });
    const result = validatePreview(ny, fields).invitation!;
    expect(result.events[0].startsAt).toBe("2028-11-05T05:30:00.000Z");
    expect(result.welcomeNote).toBeUndefined();
    expect(result.events[0].venue.mapsUrl).toBe(ny.events[0].venue.mapsUrl);
  });

  it("rejects a skipped wall time during Lord Howe's 30-minute spring transition", () => {
    const sample = invitationSchema.parse({
      ...shellDemoInvitation,
      timeZone: "Australia/Lord_Howe",
    });
    const fields = previewFields(sample);
    Object.assign(fields.events[0], { date: "2028-10-01", time: "02:15" });
    expect(validatePreview(sample, fields).errors?.["events.0.time"]).toMatch(
      /does not exist/,
    );
  });

  it("uses the earlier occurrence of a repeated wall time during Lord Howe's 30-minute fall transition", () => {
    const sample = invitationSchema.parse({
      ...shellDemoInvitation,
      timeZone: "Australia/Lord_Howe",
    });
    const fields = previewFields(sample);
    Object.assign(fields.events[0], { date: "2028-04-02", time: "01:45" });
    expect(validatePreview(sample, fields).invitation?.events[0].startsAt).toBe(
      "2028-04-01T14:45:00.000Z",
    );
  });

  it("preserves the exact later-fold timestamp with its offset and fractional seconds while editing another event", () => {
    const laterStart = "2028-11-05T01:30:42.125-05:00";
    const event = shellDemoInvitation.events[0];
    const sample = invitationSchema.parse({
      ...ny,
      events: [
        { ...event, startsAt: laterStart },
        {
          ...event,
          id: "another-ceremony",
          startsAt: "2028-11-06T15:45:12.123Z",
        },
      ],
    });
    const fields = previewFields(sample);
    expect(fields.events[0]).toMatchObject({
      date: "2028-11-05",
      time: "01:30",
    });
    Object.assign(fields.events[1], { date: "2028-11-06", time: "11:00" });

    const result = validatePreview(sample, fields).invitation!;
    expect(result.events[0]).toEqual(sample.events[0]);
    expect(result.events[0].startsAt).toBe(laterStart);
    expect(result.events[1].startsAt).toBe("2028-11-06T16:00:00.000Z");
  });
});
