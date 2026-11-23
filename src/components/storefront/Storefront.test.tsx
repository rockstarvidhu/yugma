import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AFTERGLOW_PRICE_PAISE } from "@/lib/checkout/contract";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import { Storefront } from "./Storefront";

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

describe("YUGMA editorial storefront", () => {
  it("keeps all five scenes and working destinations in the static markup", () => {
    const { container } = render(<Storefront />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Cinematic digital wedding invitations",
      }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "More than where and when.",
      "Afterglow",
      "How it works",
      "Give your story a beginning.",
    ]);
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Footer navigation" }),
    ).toBeInTheDocument();
    for (const link of container.querySelectorAll<HTMLAnchorElement>(
      "a[href]",
    )) {
      const url = new URL(link.href);
      if (url.origin !== window.location.origin) {
        expect(url.href).toBe("https://github.com/rockstarvidhu/yugma/issues");
      } else if (url.hash && url.pathname === "/") {
        expect(container.querySelector(url.hash)).not.toBeNull();
      } else {
        expect(["/templates", "/demo/afterglow"]).toContain(url.pathname);
      }
    }
  });

  it("offers a single accessible sentence with five stable motion targets", () => {
    const { container } = render(<Storefront />);
    expect(
      screen.getByRole("heading", { name: "More than where and when." }),
    ).toBeVisible();
    expect(
      Array.from(
        container.querySelectorAll("[data-home-word]"),
        (word) => word.textContent,
      ),
    ).toEqual(["More", "than", "where", "and", "when."]);
  });

  it("features one registered design and sends visitors to the real personalized and sample previews", () => {
    render(<Storefront />);
    expect(
      getStorefrontCatalogue().map(({ templateId }) => templateId),
    ).toEqual(["afterglow"]);
    const featured = within(screen.getByRole("region", { name: "Afterglow" }));
    expect(
      featured.getByRole("img", { name: /sample cover.*Demo watermark/ }),
    ).toHaveAttribute("loading", "lazy");
    expect(
      featured.getByRole("link", { name: "View Live Demo" }),
    ).toHaveAttribute("href", "/demo/afterglow");
    expect(featured.getByRole("link", { name: "Personalize" })).toHaveAttribute(
      "href",
      "/demo/afterglow?personalize=1#preview-editor",
    );
    expect(featured.queryByText(/₹|test mode/i)).toBeNull();
    expect(featured.queryByRole("button")).toBeNull();
    expect(getStorefrontCatalogue({ get: () => undefined })).toEqual([]);
  });

  it("labels the canonical configured price as Test Mode when enabled", () => {
    render(<Storefront showTestPrice studioAvailable />);
    const expected = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(AFTERGLOW_PRICE_PAISE / 100);
    expect(screen.getByText(expected + " one-time in Test Mode")).toBeVisible();
    expect(
      within(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).getByRole("link", { name: "Studio" }),
    ).toHaveAttribute("href", "/studio");
    expect(screen.queryByRole("link", { name: /buy|checkout/i })).toBeNull();
  });

  it("uses a native mobile disclosure and closes it with Escape", () => {
    const { container } = render(<Storefront />);
    const details = container.querySelector("details")!;
    const toggle = details.querySelector("summary")!;
    details.open = true;
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    const link = within(nav).getByRole("link", { name: "Invitations" });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(details.open).toBe(false);
  });

  it("serves a single high-priority hero request with independent crops", () => {
    const { container } = render(<Storefront photographic />);
    const picture = container.querySelector(".home-hero-art");
    const landscape = picture?.querySelector("source[sizes]");
    const portrait = picture?.querySelector("img");
    expect(landscape?.getAttribute("srcset")).toMatch(
      /hero-desktop-960\.webp 960w.*hero-desktop-1440\.webp 1440w.*hero-desktop-1920\.webp 1920w/,
    );
    expect(portrait?.getAttribute("srcset")).toMatch(
      /hero-mobile-480\.webp 480w.*hero-mobile-720\.webp 720w.*hero-mobile-1080\.webp 1080w/,
    );
    expect(portrait).toHaveAttribute("fetchpriority", "high");
    expect(portrait).toHaveAttribute("loading", "eager");
    expect(portrait).toHaveAttribute("alt", "");
    expect(picture?.querySelectorAll("img")).toHaveLength(1);
  });

  it("uses a branded homepage unless local image review is explicitly enabled", () => {
    vi.stubEnv("YUGMA_STOREFRONT_PHOTO_PREVIEW", "");
    const { container } = render(<Storefront />);
    expect(container.querySelector("[data-hero-art=brand]")).not.toBeNull();
    expect(container.querySelector(".home-hero-art")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
