import type { StorefrontTemplate } from "../storefront-listing";
export const afterglowListing: StorefrontTemplate = {
  templateId: "afterglow",
  name: "Afterglow",
  description:
    "A photographic cover and warm ivory pages for your story, ceremonies and wedding details.",
  features: [
    ["Cover photograph", "Choose a photo for your invitation."],
    ["Ceremony details", "Keep dates, times and venues together."],
    ["Guest directions", "Open venue directions from the invitation."],
  ],
  paletteLabel: "Ivory & burgundy",
  demoUrl: "/demo/afterglow",
  personalizeUrl: "/demo/afterglow?personalize=1#preview-editor",
  heirloomSampleUrl: "/demo/heirloom",
  preview: {
    src: "/images/storefront/afterglow-editorial-portrait.webp",
    alt: "Afterglow invitation cover for the fictional wedding of Tara and Neel",
    width: 430,
    height: 615,
  },
  availability: "demo-available",
  price: {
    currency: "INR",
    billing: "one-time",
  },
};
