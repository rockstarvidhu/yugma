import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { invitationSchema } from "@/lib/invitation-schema";
import { Cover } from "@/components/invitation/Cover";
import { shellDemoInvitation } from "@/templates/internal/demo-invitation";

afterEach(cleanup);

describe("Cover", () => {
  it("shows invitation names, welcome, local date, and an immediate details link", () => {
    render(<Cover invitation={shellDemoInvitation} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tara & Neel",
    );
    expect(
      screen.getByText(/With full hearts and our favourite people/),
    ).toBeVisible();
    expect(screen.getByText("Sunday, 12 December 2027")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Explore the celebration/ }),
    ).toHaveAttribute("href", "#celebration");
  });

  it("resolves the approved demo URL to a local photo and preserves its metadata", () => {
    render(<Cover invitation={shellDemoInvitation} />);

    const photo = screen.getByAltText(
      "A couple in traditional Indian wedding attire in a garden",
    );
    expect(photo).toHaveStyle({ objectPosition: "50% 42%" });
    expect(photo).toHaveAttribute("sizes", "100vw");
    const optimizedUrl = new URL(
      photo.getAttribute("src")!,
      "https://yugma.test",
    );
    expect(optimizedUrl.searchParams.get("url")).toBe(
      "/invitations/heirloom-demo.jpg",
    );
  });

  it.each([
    "https://customer.example/wedding.jpg",
    "https://images.unsplash.com/different-photo",
  ])("uses the gradient for a valid but unsupported source %s", (src) => {
    const invitation = invitationSchema.parse({
      ...shellDemoInvitation,
      coverImage: { src, alt: "A wedding photo" },
    });

    const { container } = render(<Cover invitation={invitation} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  });

  it("uses the gradient when the approved photo fails to load", () => {
    render(<Cover invitation={shellDemoInvitation} />);
    const photo = screen.getByAltText(
      "A couple in traditional Indian wedding attire in a garden",
    );
    expect(photo).not.toBeVisible();
    fireEvent.error(photo);

    expect(photo).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(screen.getByRole("link")).toHaveAttribute("href", "#celebration");
  });

  it("shows the earliest celebration in the invitation timezone regardless of event order", () => {
    const [wedding] = shellDemoInvitation.events;
    const earlier = {
      ...wedding,
      id: "welcome",
      title: "Welcome dinner",
      startsAt: "2027-12-10T21:00:00Z",
    };
    const { rerender } = render(
      <Cover
        invitation={{ ...shellDemoInvitation, events: [wedding, earlier] }}
      />,
    );

    expect(screen.getByText("Saturday, 11 December 2027")).toBeVisible();
    expect(screen.getByText("Celebrations begin")).toBeVisible();
    rerender(
      <Cover
        invitation={{ ...shellDemoInvitation, events: [earlier, wedding] }}
      />,
    );
    expect(screen.getByText("Saturday, 11 December 2027")).toBeVisible();
  });

  it("wraps long names and keeps the cover when no photo is set", () => {
    const longName = "A name with a long memorable family name Mehta-Iyer";
    const invitation = {
      ...shellDemoInvitation,
      couple: { partnerOne: longName, partnerTwo: "Neel" },
      coverImage: undefined,
    };
    const { container } = render(<Cover invitation={invitation} />);

    expect(container.querySelector("h1")).toHaveTextContent(longName);
    expect(container.querySelector(".heirloom-cover__image")).toBeNull();
    expect(container.querySelector(".heirloom-cover")).toHaveClass(
      "heirloom-cover",
    );
  });
});
