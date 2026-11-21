import { AFTERGLOW_PRICE_PAISE } from "@/lib/checkout/contract";
import { templateRegistry } from "@/templates/registry";

/** Presentation metadata only. Invitation content stays in the canonical schema. */
type StorefrontTemplate = {
  templateId: string;
  name: string;
  description: string;
  paletteLabel: string;
  moodLabel: string;
  demoUrl: `/demo/${string}`;
  personalizeUrl: `/demo/${string}?personalize=1#preview-editor`;
  alternateDemoUrls: readonly `/demo/${string}`[];
  preview: { src: string; alt: string; width: number; height: number };
  availability: "demo-available";
  purchaseAvailable: false;
  createUrl: null;
  price: { currency: "INR"; billing: "one-time"; amountMinor: number | null };
};

export type StorefrontCollectionItem =
  | StorefrontTemplate
  | {
      templateId: string;
      name: string;
      availability: "coming-soon";
      preview: StorefrontTemplate["preview"];
    };

const afterglow: StorefrontTemplate = {
  templateId: "afterglow",
  name: "Afterglow",
  description:
    "A photographic cover and warm ivory pages for your story, ceremonies and wedding details.",
  paletteLabel: "Ivory & burgundy",
  moodLabel: "Warm & timeless",
  demoUrl: "/demo/afterglow",
  personalizeUrl: "/demo/afterglow?personalize=1#preview-editor",
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
  price: {
    currency: "INR",
    billing: "one-time",
    amountMinor: AFTERGLOW_PRICE_PAISE,
  },
};

const upcoming: readonly StorefrontCollectionItem[] = [
  {
    templateId: "jasmine-hour",
    name: "Jasmine Hour",
    image: "coming-soon.webp",
    alt: "Ivory stationery with rose ribbon, jasmine and wedding rings",
  },
  {
    templateId: "moonlit-vows",
    name: "Moonlit Vows",
    image: "moonlit-vows.webp",
    alt: "Silver wedding bands and a white flower on midnight-blue silk",
  },
  {
    templateId: "marigold-reverie",
    name: "Marigold Reverie",
    image: "marigold-reverie.webp",
    alt: "Orange marigolds and a brass bowl in warm sunlight",
  },
  {
    templateId: "letters-at-dusk",
    name: "Letters at Dusk",
    image: "letters-at-dusk.webp",
    alt: "A sage envelope and a pressed flower on lavender fabric",
  },
].map(({ templateId, name, image, alt }) => ({
  templateId,
  name,
  availability: "coming-soon",
  preview: {
    src: `/images/storefront/${image}`,
    alt,
    width: 720,
    height: 1008,
  },
}));

export function getStorefrontCollection(
  registry = templateRegistry,
): readonly StorefrontCollectionItem[] {
  return registry.get(afterglow.templateId) ? [afterglow, ...upcoming] : [];
}
