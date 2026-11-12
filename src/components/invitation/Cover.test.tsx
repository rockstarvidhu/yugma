import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Cover } from "@/components/invitation/Cover";
import { shellDemoInvitation } from "@/templates/internal/demo-invitation";

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
