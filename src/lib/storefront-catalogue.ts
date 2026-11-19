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
    "A photographic beginning, warm ivory pages and thoughtful details for your celebration. Includes the Heirloom cover.",
  paletteLabel: "Ivory & burgundy",
  moodLabel: "Warm & timeless",
  demoUrl: "/demo/afterglow",
  personalizeUrl: "/demo/afterglow",
  alternateDemoUrls: ["/demo/heirloom"],
  preview: {
    src: "/invitations/heirloom-demo.jpg",
    alt: "The Afterglow sample cover photograph: a couple in traditional Indian wedding attire in a garden",
    width: 1920,
    height: 1281,
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
