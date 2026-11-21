import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import Home, { metadata } from "./page";
import BrandPreview from "./dev/brand/page";
import TemplatesPage, { metadata as catalogueMetadata } from "./templates/page";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/Button";

vi.mock("next/font/google", () => ({
  Manrope: () => ({ variable: "mock-manrope" }),
  Instrument_Serif: () => ({ variable: "mock-instrument" }),
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("YUGMA brand foundations", () => {
  it("identifies the homepage with the official wordmark and description", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Some moments deserve more.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: "YUGMA home" })[0],
    ).toHaveAttribute("src", "/brand/yugma-wordmark-forest.svg");
    expect(
      screen.getByText(
        "Digital wedding invitations for the story only you can tell.",
      ),
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
  it("lists the registered design with separate sample and personalization links", () => {
    render(<TemplatesPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Wedding invitation templates",
      }),
    ).toBeVisible();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(5);
    const upcoming = within(cards[1]);
    expect(
      upcoming.getByRole("heading", { name: "Jasmine Hour" }),
    ).toBeVisible();
    expect(screen.getAllByText("Coming soon")).toHaveLength(4);
    expect(upcoming.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("₹899 one-time")).toBeVisible();
    expect(screen.getByText("in Test Mode")).toBeVisible();
    expect(screen.getByRole("link", { name: "Try Demo" })).toHaveAttribute(
      "href",
      "/demo/afterglow",
    );
    expect(screen.getByRole("link", { name: "Personalize" })).toHaveAttribute(
      "href",
      "/demo/afterglow?personalize=1#preview-editor",
    );
    expect(catalogueMetadata.alternates?.canonical).toBe("/templates");
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
