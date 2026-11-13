import { invitationSchema } from "@/lib/invitation-schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Afterglow } from "./afterglow/Afterglow";
import { createTemplateRegistry, templateRegistry } from "./registry";
import { shellDemoInvitation } from "./internal/demo-invitation";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import AfterglowDemo, { metadata } from "@/app/demo/afterglow/page";
import HeirloomDemo, {
  metadata as heirloomMetadata,
} from "@/app/demo/heirloom/page";
import type { InvitationTemplateProps } from "./types";

afterEach(cleanup);

describe("template registry and renderer", () => {
  it("looks up the stable Afterglow ID", () => {
    expect(templateRegistry.get("afterglow")?.Component).toBe(Afterglow);
  });
  it.each(["unknown", "", "__proto__", "constructor"])(
    "safely handles unsupported ID %s",
    (id) => {
      expect(templateRegistry.get(id)).toBeUndefined();
      render(
        <InvitationRenderer templateId={id} invitation={shellDemoInvitation} />,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        "template is unavailable",
      );
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    },
  );
  it("rejects duplicate IDs", () => {
    expect(() =>
      createTemplateRegistry([
        { id: "same", Component: Afterglow },
        { id: "same", Component: Afterglow },
      ]),
    ).toThrow("Duplicate template ID");
  });
  it.each(["", " ", " afterglow"])("rejects invalid registered ID %s", (id) => {
    expect(() =>
      createTemplateRegistry([{ id, Component: Afterglow }]),
    ).toThrow("non-empty and trimmed");
  });
  it("renders supplied names, welcome, events and venues with explicit timezone", () => {
    const invitation = invitationSchema.parse({
      ...shellDemoInvitation,
      couple: { partnerOne: "Alex", partnerTwo: "Sam" },
      welcomeNote: "Our own welcome",
      timeZone: "Asia/Kolkata",
      events: [
        {
          id: "second",
          title: "Morning gathering",
          startsAt: "2027-12-14T10:00:00Z",
          venue: {
            name: "Garden Court",
            address: "Another fictional address",
            mapsUrl: "https://maps.google.com/?q=Jaipur+Rajasthan",
          },
        },
        {
          id: "new",
          title: "An evening together",
          startsAt: "2027-12-12T22:00:00Z",
          venue: {
            name: "Orchid House",
            address: "Fictional address",
            mapsUrl: "https://maps.google.com/?q=Jaipur+Rajasthan",
          },
        },
      ],
    });
    render(
      <InvitationRenderer templateId="afterglow" invitation={invitation} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Alex & Sam",
    );
    expect(screen.getByText("Our own welcome")).toBeInTheDocument();
    expect(screen.queryByText("Tara")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "An evening together" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Morning gathering" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Orchid House")).toBeInTheDocument();
    expect(screen.getByText("Fictional address")).toBeInTheDocument();
    const timeline = screen.getByRole("region", { name: "Celebrate with us" });
    const times = [...timeline.querySelectorAll("time")];
    expect(times.map((time) => time.dateTime)).toEqual([
      "2027-12-12T22:00:00Z",
      "2027-12-14T10:00:00Z",
    ]);
    expect(times[0]).toHaveTextContent("Monday, 13 December 2027");
    expect(times[0]).toHaveTextContent("3:30 am");
    expect(
      within(timeline).getByText("All times shown in Asia/Kolkata"),
    ).toBeVisible();
  });
  it("renders an invitation with a long name and no welcome note or photos", () => {
    const longName = "A".repeat(80);
    const invitation = invitationSchema.parse({
      ...shellDemoInvitation,
      couple: { partnerOne: longName, partnerTwo: "Sam" },
      coverImage: undefined,
      welcomeNote: undefined,
      closingNote: undefined,
      hosts: undefined,
    });

    const { container } = render(
      <InvitationRenderer templateId="afterglow" invitation={invitation} />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      `${longName} & Sam`,
    );
    expect(container.querySelector(".invitation-story")).toBeNull();
    expect(container.querySelector(".invitation-closing")).toBeNull();
    expect(container.querySelector(".heirloom-cover")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
  it("renders another registered component without renderer changes", () => {
    function Second({ invitation }: InvitationTemplateProps) {
      return <h1>A second style for {invitation.couple.partnerOne}</h1>;
    }
    const registry = createTemplateRegistry([
      { id: "afterglow", Component: Afterglow },
      { id: "second", Component: Second },
    ]);
    render(
      <InvitationRenderer
        registry={registry}
        templateId="second"
        invitation={shellDemoInvitation}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "A second style for Tara" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Celebrate with us")).not.toBeInTheDocument();
  });
  it("shows a demo watermark and fictional invitation on the route", () => {
    render(<AfterglowDemo />);
    expect(
      screen.getByRole("complementary", { name: "Demo preview" }),
    ).toHaveTextContent("YUGMA • DEMO");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tara & Neel",
    );
    expect(
      screen.getByRole("link", { name: "Celebration schedule" }),
    ).toHaveAttribute("href", "#celebration");
    expect(
      screen.getByRole("link", { name: "Venue information" }),
    ).toHaveAttribute("href", "#venues");
    const venueSection = screen.getByRole("region", { name: "Wedding venues" });
    expect(venueSection).toHaveAttribute("id", "venues");
    const schedule = screen.getByRole("region", { name: "Celebrate with us" });
    expect(schedule).toHaveAttribute("id", "celebration");
    expect(
      within(schedule).queryByRole("link", { name: /Get Directions/i }),
    ).toBeNull();
    const directions = within(venueSection).getByRole("link", {
      name: /get directions to the marigold courtyard/i,
    });
    expect(directions).toHaveAttribute(
      "href",
      shellDemoInvitation.events[0].venue.mapsUrl,
    );
    expect(directions).toHaveAttribute("target", "_blank");
    expect(directions).toHaveAttribute("rel", "noopener noreferrer");
    const cover = screen.getByRole("heading", { level: 1 }).closest("header")!;
    const story = screen.getByRole("region", { name: "A note from us" });
    const closing = screen
      .getByRole("heading", { name: "With love" })
      .closest("footer")!;
    const journey = [cover, story, schedule, venueSection, closing];
    for (let index = 1; index < journey.length; index++) {
      expect(
        journey[index - 1].compareDocumentPosition(journey[index]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(
      within(cover).getByAltText(shellDemoInvitation.coverImage!.alt),
    ).toBeInTheDocument();
    expect(
      within(story).getByText(shellDemoInvitation.welcomeNote!),
    ).toBeVisible();
    expect(screen.getAllByText(shellDemoInvitation.welcomeNote!)).toHaveLength(
      1,
    );
    expect(
      screen.getAllByRole("link", { name: /Get Directions/i }),
    ).toHaveLength(1);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("serves the default sample at /demo/heirloom with a non-dismissible watermark", () => {
    const { container } = render(<HeirloomDemo />);
    const watermark = screen.getByRole("complementary", {
      name: "Demo preview",
    });
    const template = container.querySelector(".afterglow-invitation");

    expect(watermark).toHaveTextContent("YUGMA • DEMO");
    expect(watermark).toHaveTextContent("Sample invitation");
    expect(
      watermark.compareDocumentPosition(template!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tara & Neel",
    );
    expect(
      screen.getByRole("link", {
        name: /get directions to the marigold courtyard/i,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /close|dismiss/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /purchase|pay|unlock/i }),
    ).not.toBeInTheDocument();
    expect(heirloomMetadata.robots).toEqual({ index: false, follow: false });
  });
  it("does not couple demo branding to the core renderer", () => {
    render(
      <InvitationRenderer
        templateId="afterglow"
        invitation={shellDemoInvitation}
      />,
    );
    expect(screen.queryByText("YUGMA DEMO")).not.toBeInTheDocument();
  });
});
