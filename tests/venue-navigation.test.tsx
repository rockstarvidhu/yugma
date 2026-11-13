import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventTimeline } from "@/components/invitation/EventTimeline";
import { QuickLinks } from "@/components/invitation/QuickLinks";
import { VenueCard } from "@/components/invitation/VenueCard";
import { Afterglow } from "@/templates/afterglow/Afterglow";
import { shellDemoInvitation } from "@/templates/internal/demo-invitation";
import { invitationSchema, weddingEventSchema } from "@/lib/invitation-schema";

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

it("lists shared venue details and directions once and associates every event with its venue", () => {
  const events = [
    {
      ...shellDemoInvitation.events[0],
      id: "first",
      title: "Ceremony",
      venue,
      location: "North entrance",
    },
    { ...shellDemoInvitation.events[0], id: "second", title: "Dinner", venue },
    {
      ...shellDemoInvitation.events[0],
      id: "third",
      title: "Reception",
      venue: {
        name: "Garden Court",
        address: "Udaipur, Rajasthan",
        mapsUrl: "https://maps.example.com/garden",
      },
    },
  ];
  render(
    <Afterglow
      invitation={invitationSchema.parse({ ...shellDemoInvitation, events })}
    />,
  );
  const schedule = within(
    screen.getByRole("region", { name: "Celebrate with us" }),
  );
  const venues = within(screen.getByRole("region", { name: "Wedding venues" }));
  const sharedEvents = within(
    venues.getAllByRole("list", { name: "Events at this venue" })[0],
  );

  expect(venues.getAllByRole("link", { name: /Get Directions/ })).toHaveLength(
    2,
  );
  expect(screen.getAllByText(venue.address)).toHaveLength(1);
  expect(sharedEvents.getByText("Ceremony")).toBeVisible();
  expect(sharedEvents.getByText(/North entrance/)).toBeVisible();
  expect(sharedEvents.getByText("Dinner")).toBeVisible();
  expect(sharedEvents.queryByText("Reception")).toBeNull();
  expect(
    venues.getByRole("link", { name: /Get Directions to Garden Court/ }),
  ).toHaveAttribute("href", "https://maps.example.com/garden");
  expect(schedule.getByText("All times shown in Asia/Kolkata")).toBeVisible();
  expect(schedule.queryByRole("link", { name: /Get Directions/ })).toBeNull();
  expect(schedule.queryByText("North entrance")).toBeNull();
});
