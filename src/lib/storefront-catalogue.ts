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
  views: readonly {
    id: string;
    label: string;
    image: string;
    alt: string;
    href: `/demo/${string}`;
    action: string;
  }[];
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
  views: [
    {
      id: "heirloom-cover",
      label: "Heirloom cover",
      image: "/images/storefront/heirloom-cover.webp",
      alt: "Tara and Neel's Heirloom invitation cover with a photograph and their wedding date",
      href: "/demo/heirloom",
      action: "View cover demo",
    },
    {
      id: "afterglow-celebration",
      label: "Celebration details",
      image: "/images/storefront/afterglow-celebration.webp",
      alt: "Afterglow's ivory invitation page showing the celebration schedule",
      href: "/demo/afterglow#celebration",
      action: "View details demo",
    },
  ],
  availability: "demo-available",
  purchaseAvailable: false,
  createUrl: null,
  price: { currency: "INR", billing: "one-time", amountMinor: null },
};

/** Only expose metadata when the actual renderer has this template registered. */
export function getStorefrontCollection(registry = templateRegistry) {
  return registry.get(afterglow.templateId) ? [afterglow] : [];
}
