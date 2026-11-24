export const reviewArtBase = "/dev/home-hero";
export function storefrontPhotoReviewEnabled() {
  return process.env.YUGMA_STOREFRONT_PHOTO_PREVIEW === "1";
}
