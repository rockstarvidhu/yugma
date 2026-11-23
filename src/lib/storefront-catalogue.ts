import { AFTERGLOW_PRICE_PAISE } from "@/lib/checkout/contract";
import { templateRegistry } from "@/templates/registry";

/** Presentation metadata only. Invitation content stays in the canonical schema. */
type StorefrontTemplate = {
  templateId: string;
  name: string;
  description: string;
  paletteLabel: string;
  demoUrl: `/demo/${string}`;
  personalizeUrl: `/demo/${string}?personalize=1#preview-editor`;
  heirloomSampleUrl: "/demo/heirloom";
  preview: { src: string; alt: string; width: number; height: number };
  availability: "demo-available";
  price: { currency: "INR"; billing: "one-time"; amountMinor: number | null };
};

const afterglow: StorefrontTemplate = {
  templateId: "afterglow",
  name: "Afterglow",
  description:
    "A photographic cover and warm ivory pages for your story, ceremonies and wedding details.",
  paletteLabel: "Ivory & burgundy",
  demoUrl: "/demo/afterglow",
  personalizeUrl: "/demo/afterglow?personalize=1#preview-editor",
  heirloomSampleUrl: "/demo/heirloom",
  preview: {
    src: "/images/storefront/heirloom-cover.webp",
    alt: "Afterglow invitation cover for the fictional wedding of Tara and Neel",
    width: 592,
    height: 833,
  },
  availability: "demo-available",
  price: {
    currency: "INR",
    billing: "one-time",
    amountMinor: AFTERGLOW_PRICE_PAISE,
  },
};

export function getStorefrontCatalogue(registry = templateRegistry) {
  return registry.get(afterglow.templateId) ? [afterglow] : [];
}
