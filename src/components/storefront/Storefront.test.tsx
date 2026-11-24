import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTemplateRegistry } from "@/templates/registry";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import { Storefront } from "./Storefront";
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Reference-led storefront", () => {
  it("renders the purpose, collection and every registered listing with real destinations", () => {
    const { container } = render(<Storefront />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Cinematic digital\s*wedding invitations/i,
    );
    expect(
      screen.getByRole("heading", {
        name: "Wedding invitations that feel personal, cinematic and yours.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Signature invitations for your celebration.",
      }),
    ).toBeVisible();
    const product = within(screen.getByRole("region", { name: "Afterglow" }));
    expect(
      product.getByRole("link", { name: /View Live Demo/ }),
    ).toHaveAttribute("href", "/demo/afterglow");
    expect(product.getByRole("link", { name: /Personalize/ })).toHaveAttribute(
      "href",
      "/demo/afterglow?personalize=1#preview-editor",
    );
    expect(product.queryByText(/₹|tax included/i)).toBeNull();
    expect(getStorefrontCatalogue(createTemplateRegistry([]))).toEqual([]);
    for (const anchor of Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a[href]"),
    )) {
      const url = new URL(anchor.href);
      if (url.pathname === "/" && url.hash)
        expect(container.querySelector(url.hash)).not.toBeNull();
    }
  });
  it("keeps candidate art and teasers out of the default catalogue", () => {
    const { container } = render(<Storefront photographic={false} />);
    expect(container.querySelector('[src^="/dev/home-hero"]')).toBeNull();
    expect(screen.queryByText("Heritage")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Next invitation" }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /github/i })).toBeNull();
  });
  it("gates portrait and landscape sources together with non-purchasable review concepts", () => {
    const { container } = render(<Storefront photographic />);
    const art = container.querySelector(".home-hero-art")!;
    expect(art.querySelector("source")).toHaveAttribute(
      "srcset",
      "/dev/home-hero/hero-wide.webp",
    );
    expect(art.querySelector("img")).toHaveAttribute(
      "src",
      "/dev/home-hero/hero-portrait.webp",
    );
    expect(art.querySelector("img")).toHaveAttribute("fetchpriority", "high");
    expect(
      screen.getByRole("button", { name: "Previous invitation" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next invitation" }),
    ).toBeEnabled();
    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
    expect(
      screen.queryByRole("link", { name: /heritage|serenity/i }),
    ).toBeNull();
  });
  it("shows the server catalogue amount only in configured private test review", () => {
    render(
      <Storefront
        photographic
        studioAvailable
        reviewPrices={{ afterglow: 91700 }}
      />,
    );
    expect(screen.getByText("₹917")).toBeVisible();
    expect(screen.getByText(/No money is charged/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /buy/i })).toBeNull();
  });
  it("routes Studio creation through the private create route and uses a configured support address", () => {
    render(<Storefront studioAvailable supportEmail="team@example.test" />);
    expect(
      within(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).getByRole("link", { name: "Get started" }),
    ).toHaveAttribute("href", "/create/afterglow");
    expect(
      screen.getByRole("link", { name: "team@example.test" }),
    ).toHaveAttribute("href", "mailto:team@example.test");
  });
  it("closes the mobile disclosure and restores keyboard focus", () => {
    const { container } = render(<Storefront />);
    const details = container.querySelector("details")!;
    details.open = true;
    const link = within(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).getByRole("link", { name: "Templates" });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")).toHaveFocus();
  });
  it("plays the arrival once per session and skips reduced motion", () => {
    const view = render(<Storefront />);
    expect(view.container.querySelector(".home-arrival")).not.toHaveAttribute(
      "hidden",
    );
    view.unmount();
    const repeat = render(<Storefront />);
    expect(repeat.container.querySelector(".home-arrival")).toHaveAttribute(
      "hidden",
    );
    repeat.unmount();
    sessionStorage.clear();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const reduced = render(<Storefront />);
    expect(reduced.container.querySelector(".home-arrival")).toHaveAttribute(
      "hidden",
    );
  });
});
