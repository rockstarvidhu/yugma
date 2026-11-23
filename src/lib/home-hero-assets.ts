export const desktopHeroSources = [
  ["hero-desktop-960.webp", 960],
  ["hero-desktop-1440.webp", 1440],
  ["hero-desktop-1920.webp", 1920],
] as const;

export const mobileHeroSources = [
  ["hero-mobile-480.webp", 480],
  ["hero-mobile-720.webp", 720],
  ["hero-mobile-1080.webp", 1080],
] as const;

export function storefrontPhotoReviewEnabled() {
  return process.env.YUGMA_STOREFRONT_PHOTO_PREVIEW === "1";
}
