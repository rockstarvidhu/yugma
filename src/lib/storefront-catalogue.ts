import { templateRegistry } from "@/templates/registry";

/** Presentation metadata only. Invitation content stays in the canonical schema. */
export type StorefrontTemplate = {
  templateId: string;
  name: string;
  description: string;
  paletteLabel: string;
  moodLabel: string;
  demoUrl: `/demo/${string}`;
  personalizeUrl: `/demo/${string}`;
  alternateDemoUrls: readonly `/demo/${string}`[];
  preview: { src: string; alt: string; width: number; height: number };
  availability: "demo-available" | "in-development";
  purchaseAvailable: false;
  createUrl: null;
  price: { currency: "INR"; billing: "one-time"; amountMinor: null };
};

const afterglow: StorefrontTemplate = {
  templateId: "afterglow",
  name: "Afterglow",
  description:
    "A photographic cover and warm ivory pages for your story, ceremonies and wedding details.",
  paletteLabel: "Ivory & burgundy",
  moodLabel: "Warm & timeless",
  demoUrl: "/demo/afterglow",
  personalizeUrl: "/demo/afterglow",
  alternateDemoUrls: ["/demo/heirloom"],
  preview: {
    src: "/images/storefront/heirloom-cover.webp",
    alt: "Afterglow invitation cover for the fictional wedding of Tara and Neel",
    width: 592,
    height: 833,
  },
  availability: "demo-available",
  purchaseAvailable: false,
  createUrl: null,
  price: { currency: "INR", billing: "one-time", amountMinor: null },
};

/** Only expose metadata when the actual renderer has this template registered. */
export function getStorefrontCollection(registry = templateRegistry) {
  return registry.get(afterglow.templateId) ? [afterglow] : [];
}
