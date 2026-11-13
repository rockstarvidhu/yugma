import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventTimeline } from "@/components/invitation/EventTimeline";
import { QuickLinks } from "@/components/invitation/QuickLinks";
import { VenueCard } from "@/components/invitation/VenueCard";
import { Afterglow } from "@/templates/afterglow/Afterglow";
import { shellDemoInvitation } from "@/templates/internal/demo-invitation";
import { invitationSchema, weddingEventSchema } from "@/lib/invitation-schema";
import { venueIdentity } from "@/lib/venue-identity";

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
      name: /Get Directions to Cedar Hall, Jaipur, Rajasthan for Dinner/,
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

describe("venue identity", () => {
  const baseMap =
    "https://www.google.com/maps/dir/?api=1&destination=9.9%2C76.2&destination_place_id=cedar";

  it.each([
    [baseMap, baseMap],
    [`${baseMap}&utm_source=email`, `${baseMap}&utm_source=chat`],
    [
      `${baseMap}&utm_campaign=wedding&utm_source=email&gclid=1`,
      `${baseMap}&utm_medium=message&UTM_content=card&fbclid=2`,
    ],
    [
      "https://www.google.com/maps/dir/?utm_source=email&api=1&destination=9.9%2C76.2&utm_campaign=weekend&destination_place_id=cedar",
      `${baseMap}&utm_campaign=weekend&utm_source=email`,
    ],
  ])(
    "consolidates equivalent destinations and retains the first original link (%#)",
    (firstUrl, secondUrl) => {
      const firstEvent = shellDemoInvitation.events[0];
      const invitation = invitationSchema.parse({
        ...shellDemoInvitation,
        events: [
          {
            ...firstEvent,
            id: "later",
            title: "Dinner",
            startsAt: "2027-12-12T18:00:00Z",
            venue: { ...venue, mapsUrl: firstUrl },
          },
          {
            ...firstEvent,
            id: "earlier",
            title: "Ceremony",
            startsAt: "2027-12-12T23:00:00+05:30",
            venue: { ...venue, mapsUrl: secondUrl },
          },
        ],
      });
      for (const event of invitation.events) {
        Object.freeze(event.venue);
        Object.freeze(event);
      }
      Object.freeze(invitation.events);
      Object.freeze(invitation);
      const before = JSON.stringify(invitation);

      render(<Afterglow invitation={invitation} />);

      const venues = within(
        screen.getByRole("region", { name: "Wedding venues" }),
      );
      expect(venues.getAllByText(venue.address)).toHaveLength(1);
      expect(venues.getByText("Ceremony")).toBeVisible();
      expect(venues.getByText("Dinner")).toBeVisible();
      const links = venues.getAllByRole("link", { name: /Get Directions/i });
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", firstUrl);
      const timeline = screen.getByRole("region", {
        name: "Celebrate with us",
      });
      expect(
        [...timeline.querySelectorAll("time")].map((time) => time.dateTime),
      ).toEqual(["2027-12-12T23:00:00+05:30", "2027-12-12T18:00:00Z"]);
      expect(JSON.stringify(invitation)).toBe(before);
    },
  );

  it.each([
    baseMap.replace("destination_place_id=cedar", "destination_place_id=other"),
    baseMap.replace("9.9%2C76.2", "10.1%2C76.3"),
    baseMap.replace("/maps/dir/", "/maps/search/"),
    `${baseMap}#entrance`,
  ])("keeps different map destinations separate (%s)", (mapsUrl) => {
    expect(venueIdentity({ ...venue, mapsUrl })).not.toBe(
      venueIdentity({ ...venue, mapsUrl: baseMap }),
    );
  });

  it("shows separate same-name venue cards and names their directions by address", () => {
    const event = shellDemoInvitation.events[0];
    const first = { ...venue, address: "Kochi Road", mapsUrl: baseMap };
    const second = {
      ...venue,
      address: "Beach Road",
      mapsUrl: `${baseMap}&utm_source=email`,
    };
    const invitation = invitationSchema.parse({
      ...shellDemoInvitation,
      events: [
        { ...event, id: "road", venue: first },
        { ...event, id: "beach", venue: second },
      ],
    });
    render(<Afterglow invitation={invitation} />);
    const venues = within(
      screen.getByRole("region", { name: "Wedding venues" }),
    );
    for (const place of [first, second]) {
      expect(venues.getByText(place.address)).toBeVisible();
      expect(
        venues.getByRole("link", {
          name: `Get Directions to Cedar Hall, ${place.address} (opens in a new tab)`,
        }),
      ).toHaveAttribute("href", place.mapsUrl);
    }
    expect(venues.getAllByRole("link")).toHaveLength(2);
  });

  it("compares missing and blank map URLs consistently without conflating them with a destination", () => {
    const { name, address } = venue;
    expect(venueIdentity({ name, address })).toBe(
      venueIdentity({ name, address, mapsUrl: " " }),
    );
    expect(venueIdentity({ name, address })).not.toBe(venueIdentity(venue));
  });
});
