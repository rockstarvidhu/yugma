import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Home, { metadata } from "./page";
import BrandPreview from "./dev/brand/page";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/Button";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("YUGMA brand foundations", () => {
  it("identifies the homepage with the official wordmark and description", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "YUGMA" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "YUGMA" })).toHaveAttribute(
      "src",
      "/brand/yugma-wordmark-forest.svg",
    );
    expect(
      screen.getByText("Thoughtfully crafted digital invitations."),
    ).toBeInTheDocument();
    expect(metadata.openGraph).toMatchObject({
      images: [{ url: "/brand/yugma-og-brand.png", width: 1200, height: 630 }],
    });
  });
  it("gives a linked emblem an accessible navigation name", () => {
    render(
      <BrandLogo variant="emblem" tone="sand" href="/" label="YUGMA home" />,
    );
    expect(screen.getByRole("link", { name: "YUGMA home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/brand/yugma-emblem-sand.svg",
    );
  });
  it("excludes decorative logos from the accessible image list", () => {
    const { container } = render(<BrandLogo decorative />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("does not submit a form by default and respects disabled controls", () => {
    render(
      <form>
        <Button disabled>Unavailable</Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Unavailable" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toBeDisabled();
  });
  it("rejects the brand preview in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => BrandPreview()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("renders the brand reference in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    render(<BrandPreview />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "A considered beginning.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "YUGMA stacked lockup" }),
    ).toBeInTheDocument();
  });
});
