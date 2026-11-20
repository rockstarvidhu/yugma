import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStorefrontCollection } from "@/lib/storefront-catalogue";
import { Storefront } from "./Storefront";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("YUGMA homepage scroll and collection", () => {
  it("keeps the headline and working destinations in static markup", () => {
    const { container } = render(<Storefront />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Some moments deserve more.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Footer navigation" }),
    ).toBeVisible();
    for (const link of container.querySelectorAll<HTMLAnchorElement>(
      "a[href]",
    )) {
      const url = new URL(link.href, "http://localhost");
      if (url.hash && url.pathname === "/")
        expect(container.querySelector(url.hash)).not.toBeNull();
      expect(["/", "/demo/heirloom", "/demo/afterglow"]).toContain(
        url.pathname,
      );
    }
  });

  it("shows two actual views of one registered template without claiming a second template", () => {
    render(<Storefront />);
    expect(screen.getByText("Afterglow", { exact: true })).toBeVisible();
    const track = within(
      screen.getByRole("list", { name: "Invitation preview slides" }),
    );
    const slides = track.getAllByRole("listitem");
    expect(slides).toHaveLength(2);
    expect(slides.map((slide) => slide.dataset.templateId)).toEqual([
      "afterglow",
      "afterglow",
    ]);
    expect(
      track.getByRole("link", { name: "View cover demo" }),
    ).toHaveAttribute("href", "/demo/heirloom");
    expect(
      track.getByRole("link", { name: "View details demo" }),
    ).toHaveAttribute("href", "/demo/afterglow#celebration");
    expect(
      track.queryByRole("link", { name: /buy|checkout|purchase|create/i }),
    ).not.toBeInTheDocument();
    expect(getStorefrontCollection({ get: () => undefined })).toEqual([]);
  });

  it("moves focus to the collection when skipping the intro", () => {
    render(<Storefront />);
    fireEvent.click(screen.getByRole("link", { name: "Skip intro" }));
    expect(
      screen.getByRole("region", { name: "The YUGMA Collection" }),
    ).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalled();
    history.replaceState(null, "", "/");
  });

  it("opens and closes the mobile disclosure with Escape and returns focus", () => {
    render(<Storefront />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(toggle);
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(toggle).toHaveAttribute("aria-controls", nav.id);
    within(nav).getByRole("link", { name: "Home" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("serves one eager hero image with distinct landscape and portrait sources", () => {
    const { container } = render(<Storefront />);
    const picture = container.querySelector(".home-moment-media picture");
    const landscape = picture?.querySelector("source");
    const portrait = picture?.querySelector("img");
    expect(landscape).toHaveAttribute("media", "(min-width: 900px)");
    expect(landscape).toHaveAttribute(
      "sizes",
      "(max-aspect-ratio: 16/9) 177.78vh, 100vw",
    );
    expect(landscape?.getAttribute("srcset")).toMatch(
      /hero-desktop-1280x720\.webp 1280w.*hero-desktop-1600x900\.webp 1600w.*hero-desktop-1920x1080\.webp 1920w/,
    );
    expect(portrait).toHaveAttribute(
      "sizes",
      "(max-aspect-ratio: 9/16) 56.25vh, 100vw",
    );
    expect(portrait?.getAttribute("srcset")).toMatch(
      /hero-mobile-540x960\.webp 540w.*hero-mobile-810x1440\.webp 810w.*hero-mobile-1080x1920\.webp 1080w/,
    );
    expect(portrait).toHaveAttribute("fetchpriority", "high");
    expect(portrait).toHaveAttribute("loading", "eager");
    expect(portrait).toHaveAttribute("alt", "");
    expect(picture?.querySelectorAll("img")).toHaveLength(1);
  });
});
