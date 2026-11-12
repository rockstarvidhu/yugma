import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventTimeline } from "@/components/invitation/EventTimeline";

const events = [
  {
    title: "Haldi",
    startsAt: "2027-11-19T10:00:00+05:30",
    location: "Courtyard",
    description: "A joyful morning ceremony.",
    dressCode: "Yellow attire",
  },
  {
    title: "Wedding ceremony",
    startsAt: "2027-11-20T09:30:00+05:30",
  },
  {
    title: "Reception",
    startsAt: "2027-11-20T19:00:00+05:30",
    venue: {
      name: "Grand Ballroom",
      address: "1 Palace Road, Jaipur",
      mapsUrl: "https://maps.example.com/venue",
    },
  },
];

describe("EventTimeline", () => {
  it("renders events in input order with local dates and times", () => {
    render(<EventTimeline events={events} />);

    const list = screen.getByRole("list");
    const titles = within(list)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual(["Haldi", "Wedding ceremony", "Reception"]);
    expect(within(list).getByText("10:00 am")).toBeInTheDocument();
    expect(within(list).getByText("9:30 am")).toBeInTheDocument();
    expect(within(list).getByText("7:00 pm")).toBeInTheDocument();
    expect(
      within(list).getAllByText("Thursday, 19 November 2027"),
    ).toHaveLength(1);
    expect(
      within(list).getAllByText("Saturday, 20 November 2027"),
    ).toHaveLength(2);
  });

  it("omits absent optional event details", () => {
    render(<EventTimeline events={[events[1]]} />);

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
    render(<EventTimeline events={[{ ...events[1], title }]} />);

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

    expect(screen.getByText("11:00 pm")).toBeInTheDocument();
    expect(
      screen.getByText("Wednesday, November 18, 2027"),
    ).toBeInTheDocument();
  });
});
