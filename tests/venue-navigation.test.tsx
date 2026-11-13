import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventTimeline } from "@/components/invitation/EventTimeline";
import { QuickLinks } from "@/components/invitation/QuickLinks";
import { VenueCard } from "@/components/invitation/VenueCard";
import { weddingEventSchema } from "@/lib/invitation-schema";

afterEach(cleanup);

const venue = {
  name: "Cedar Hall",
  address: "Jaipur, Rajasthan",
  mapsUrl: "https://maps.example.com/cedar",
};

describe("VenueCard", () => {
  it("shows venue, event and location with a keyboard-focusable safe directions link", () => {
    render(
      <VenueCard venue={venue} location="North entrance" eventTitle="Dinner" />,
    );
    expect(screen.getByText(venue.name)).toBeVisible();
    expect(screen.getByText(venue.address)).toBeVisible();
    expect(screen.getByText("North entrance")).toBeVisible();
    expect(screen.getByText("Dinner")).toBeVisible();
    const link = screen.getByRole("link", {
      name: /Get Directions to Cedar Hall for Dinner/,
    });
    expect(link).toHaveAttribute("href", venue.mapsUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    link.focus();
    expect(link).toHaveFocus();
  });

  it.each([
    undefined,
    "",
    "javascript:alert(1)",
    "https://user@example.com/map",
  ])("keeps the address and omits an unusable map URL (%s)", (mapsUrl) => {
    render(<VenueCard venue={{ ...venue, mapsUrl }} />);
    expect(screen.getByText(venue.name)).toBeVisible();
    expect(screen.getByText(venue.address)).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders canonical maximum-length venue names and addresses", () => {
    const name = "N".repeat(120);
    const address = "A".repeat(240);
    render(<VenueCard venue={{ name, address }} />);
    expect(screen.getByText(name)).toBeVisible();
    expect(screen.getByText(address)).toBeVisible();
  });

  it("renders the correct venue and exactly one directions action for each event", () => {
    const other = {
      name: "Garden Court",
      address: "Udaipur, Rajasthan",
      mapsUrl: "https://maps.example.com/garden",
    };
    const events = weddingEventSchema.array().parse([
      {
        id: "first",
        title: "Ceremony",
        startsAt: "2027-12-12T17:30:00+05:30",
        venue,
      },
      {
        id: "second",
        title: "Reception",
        startsAt: "2027-12-12T19:30:00+05:30",
        venue: other,
      },
    ]);
    render(<EventTimeline events={events} timeZone="Asia/Kolkata" />);
    const rows = screen.getAllByRole("listitem");
    for (const [index, place] of [venue, other].entries()) {
      const row = within(rows[index]);
      expect(row.getByText(place.address)).toBeVisible();
      expect(
        row.getByRole("link", { name: new RegExp(place.name) }),
      ).toHaveAttribute("href", place.mapsUrl);
      expect(row.getAllByRole("link")).toHaveLength(1);
    }
  });
});

describe("QuickLinks", () => {
  it("points to two existing, distinct section targets", () => {
    render(
      <>
        <QuickLinks scheduleId="celebration" venueId="venues" />
        <section id="celebration">Schedule</section>
        <section id="venues">Venues</section>
      </>,
    );
    const nav = screen.getByRole("navigation", {
      name: "Invitation quick links",
    });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#celebration",
      "#venues",
    ]);
    for (const link of links) {
      expect(
        document.querySelector(link.getAttribute("href")!),
      ).toBeInTheDocument();
    }
  });

  it("omits unavailable destinations and the empty navigation landmark", () => {
    const { rerender } = render(<QuickLinks venueId="venues" />);
    expect(
      screen.queryByRole("link", { name: "Celebration schedule" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Venue information" }),
    ).toHaveAttribute("href", "#venues");
    rerender(<QuickLinks />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
