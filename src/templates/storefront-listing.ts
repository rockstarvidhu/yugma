/** Presentation metadata only. Invitation content stays in the canonical schema. */
export type StorefrontTemplate = {
  templateId: string;
  name: string;
  description: string;
  features: readonly (readonly [string, string])[];
  paletteLabel: string;
  demoUrl: `/demo/${string}`;
  personalizeUrl: `/demo/${string}?personalize=1#preview-editor`;
  heirloomSampleUrl: "/demo/heirloom";
  preview: { src: string; alt: string; width: number; height: number };
  availability: "demo-available";
  price: { currency: "INR"; billing: "one-time" };
};
