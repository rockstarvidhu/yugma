export const heroFallback = "/images/storefront/brand-hero.svg";

export function getLocalHero() {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.YUGMA_LOCAL_HERO === "1"
  ) {
    return "http://127.0.0.1:3161/hero.webp";
  }
  return undefined;
}
