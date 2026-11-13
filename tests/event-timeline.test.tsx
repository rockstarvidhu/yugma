import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventTimeline } from "@/components/invitation/EventTimeline";
import { weddingEventSchema } from "@/lib/invitation-schema";

afterEach(cleanup);

const venue = {
  name: "Grand Ballroom",
  address: "1 Palace Road, Jaipur",
  mapsUrl: "https://maps.example.com/venue",
};

const events = weddingEventSchema.array().parse([
  {
    id: "haldi",
    title: "Haldi",
    venue,
    startsAt: "2027-11-19T10:00:00+05:30",
    location: "Courtyard",
    description: "A joyful morning ceremony.",
    dressCode: "Yellow attire",
  },
  {
    id: "wedding",
    title: "Wedding ceremony",
    venue,
    startsAt: "2027-11-20T09:30:00+05:30",
  },
  {
    id: "reception",
    title: "Reception",
    startsAt: "2027-11-20T19:00:00+05:30",
    venue,
  },
]);

describe("EventTimeline", () => {
  it("renders event details with local dates and times", () => {
    render(<EventTimeline events={events} timeZone="Asia/Kolkata" />);

    const list = screen.getByRole("list");
    const titles = within(list)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual(["Haldi", "Wedding ceremony", "Reception"]);
    const haldi = within(screen.getAllByRole("listitem")[0]);
    expect(haldi.getByText(venue.name)).toBeVisible();
    expect(haldi.getByText(venue.address)).toBeVisible();
    expect(haldi.getByText("Courtyard")).toBeVisible();
    expect(haldi.getByText("A joyful morning ceremony.")).toBeVisible();
    expect(haldi.getByText(/Yellow attire/)).toBeVisible();
    expect(within(list).getByText("10:00 am")).toBeInTheDocument();
    expect(within(list).getByText("9:30 am")).toBeInTheDocument();
    expect(within(list).getByText("7:00 pm")).toBeInTheDocument();
    expect(within(list).getAllByText("Friday, 19 November 2027")).toHaveLength(
      1,
    );
    expect(
      within(list).getAllByText("Saturday, 20 November 2027"),
    ).toHaveLength(2);
  });

  it("sorts frozen, unsorted events by instant across UTC offsets", () => {
    const unsorted = Object.freeze(
      weddingEventSchema
        .array()
        .parse([
          { ...events[0], title: "Later", startsAt: "2027-12-12T21:00:00Z" },
          {
            ...events[1],
            title: "Earlier",
            startsAt: "2027-12-12T23:00:00+05:30",
          },
          { ...events[2], title: "Middle", startsAt: "2027-12-12T20:00:00Z" },
        ])
        .map((event) => Object.freeze(event)),
    );
    const before = JSON.stringify(unsorted);

    render(<EventTimeline events={unsorted} timeZone="Asia/Kolkata" />);

    expect(
      within(screen.getByRole("list"))
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Earlier", "Middle", "Later"]);
    expect(JSON.stringify(unsorted)).toBe(before);
  });

  it("keeps input order for equal instants expressed with different offsets", () => {
    const tied = weddingEventSchema.array().parse([
      { ...events[2], startsAt: "2027-12-12T23:30:00+05:30" },
      { ...events[0], startsAt: "2027-12-12T17:00:00Z" },
      { ...events[1], startsAt: "2027-12-12T18:00:00Z" },
    ]);

    render(<EventTimeline events={tied} timeZone="Asia/Kolkata" />);

    expect(
      within(screen.getByRole("list"))
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Haldi", "Reception", "Wedding ceremony"]);
  });

  it("omits absent optional event details", () => {
    render(<EventTimeline events={[events[1]]} timeZone="Asia/Kolkata" />);

    expect(
      screen.getByRole("heading", { name: "Wedding ceremony" }),
    ).toBeVisible();
    expect(screen.queryByText("Attire:")).not.toBeInTheDocument();
    expect(
      screen.queryByText("A joyful morning ceremony."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Courtyard")).not.toBeInTheDocument();
  });

  it("wraps long event names instead of clipping them", () => {
    const title =
      "A particularly long traditional ceremony name shared by both families";
    render(
      <EventTimeline
        events={[{ ...events[1], title }]}
        timeZone="Asia/Kolkata"
      />,
    );

    expect(screen.getByRole("heading", { name: title })).toHaveClass(
      "break-words",
    );
  });

  it("formats times in the requested local time zone", () => {
    render(
      <EventTimeline
        events={[events[0]]}
        timeZone="America/New_York"
        locale="en-US"
      />,
    );

    expect(
      screen.getAllByText("All times shown in America/New_York"),
    ).toHaveLength(1);
    expect(screen.getByText(/^11:30 pm$/i)).toBeInTheDocument();
    expect(screen.getByText("Thursday, November 18, 2027")).toBeInTheDocument();
  });
});

it.each(["", "javascript:alert(1)", "https://user:pass@example.com/map"])(
  "omits directions for an unusable map URL (%s)",
  (mapsUrl) => {
    render(
      <EventTimeline
        events={[{ ...events[0], venue: { ...venue, mapsUrl } }]}
        timeZone="Asia/Kolkata"
      />,
    );
    expect(screen.getByText(venue.name)).toBeVisible();
    expect(screen.queryByRole("link", { name: /get directions/i })).toBeNull();
  },
);
