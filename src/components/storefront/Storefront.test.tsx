import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStorefrontCollection } from "@/lib/storefront-catalogue";
import { templateRegistry } from "@/templates/registry";
import { Storefront } from "./Storefront";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("customer storefront foundation", () => {
  it("has one primary heading, labelled landmarks and only real internal destinations", () => {
    const { container } = render(<Storefront />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
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
      if (url.hash) expect(container.querySelector(url.hash)).not.toBeNull();
      expect(["/", "/demo/afterglow"]).toContain(url.pathname);
    }
    expect(
      within(
        screen.getByRole("region", {
          name: "Some moments deserve more than an invitation.",
        }),
      ).getByRole("link", { name: "Try a Demo" }),
    ).toHaveAttribute("href", "/demo/afterglow");
  });
  it("exposes only an actual registered design and accurately labels demo-only availability", () => {
    render(<Storefront />);
    const list = within(
      screen.getByRole("list", { name: "Template collection" }),
    );
    const cards = list.getAllByRole("listitem");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("data-template-id", "afterglow");
    expect(list.getByRole("heading", { name: "Afterglow" })).toBeVisible();
    expect(list.queryByRole("heading", { name: "Heirloom" })).toBeNull();
    expect(list.queryByText(/Thread Between Us/)).toBeNull();
    expect(list.getByText(/Purchasing is not available yet/)).toBeVisible();
    expect(
      list.queryByRole("link", { name: /buy|checkout|purchase|create/i }),
    ).toBeNull();
    expect(list.queryByText(/₹/)).toBeNull();
    for (const item of getStorefrontCollection())
      expect(templateRegistry.get(item.templateId)).toBeDefined();
  });
  it("omits entries when their renderer is unavailable instead of presenting dead demos", () => {
    expect(getStorefrontCollection({ get: () => undefined })).toEqual([]);
  });
  it("opens a labelled mobile disclosure and closes with Escape while returning focus", () => {
    render(<Storefront />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
    fireEvent.click(toggle);
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(toggle).toHaveAttribute("aria-controls", nav.id);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const first = within(nav).getByRole("link", { name: "Home" });
    first.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
  });
  it("closes the mobile menu when a real section link is activated", () => {
    render(<Storefront />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const nav = screen.getByRole("navigation", { name: "Mobile navigation" });
    fireEvent.click(within(nav).getByRole("link", { name: "Templates" }));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
  it("closes the disclosure on outside interaction", () => {
    render(<Storefront />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.pointerDown(screen.getByRole("main"));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
  it("keeps the focal hero separate from text and uses the approved local asset", () => {
    render(<Storefront />);
    const hero = screen.getByRole("region", {
      name: "Some moments deserve more than an invitation.",
    });
    const photo = within(hero).getByRole("img", { name: /joining hands/ });
    expect(photo.getAttribute("src")).toContain("hands-temporary.webp");
    expect(hero.querySelector("h1 img")).toBeNull();
    expect(photo).toHaveAttribute("sizes");
  });
});
