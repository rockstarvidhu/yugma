import { BrandLogo } from "@/components/brand/BrandLogo";
import { storefrontRoutes } from "@/lib/storefront-routes";
import { desktopHeroSources, mobileHeroSources } from "@/lib/home-hero-assets";

const heroDirectory = "/dev/home-hero";

function sourceSet(sources: readonly (readonly [string, number])[]) {
  return sources
    .map(([file, width]) => heroDirectory + "/" + file + " " + width + "w")
    .join(", ");
}

export function HomepageHeroSequence({
  photographic,
  demoUrl,
}: {
  photographic: boolean;
  demoUrl?: string;
}) {
  return (
    <section
      className="home-hero"
      id="home"
      data-hero-art={photographic ? "photo" : "brand"}
      aria-labelledby="hero-heading"
      tabIndex={-1}
    >
      {photographic && (
        <picture className="home-hero-art">
          <source
            media="(prefers-reduced-data: reduce) and (min-width: 700px) and (min-aspect-ratio: 1/1), (prefers-reduced-data: reduce) and (min-width: 1000px)"
            srcSet={heroDirectory + "/" + desktopHeroSources[0][0]}
            type="image/webp"
            width={960}
            height={540}
          />
          <source
            media="(prefers-reduced-data: reduce)"
            srcSet={heroDirectory + "/" + mobileHeroSources[0][0]}
            type="image/webp"
            width={480}
            height={853}
          />
          <source
            media="(min-width: 700px) and (min-aspect-ratio: 1/1), (min-width: 1000px)"
            type="image/webp"
            srcSet={sourceSet(desktopHeroSources)}
            sizes="(max-aspect-ratio: 16/9) 178svh, 100vw"
            width={1920}
            height={1080}
          />
          {/* The photo kit provides optimized art-directed WebP variants. */}
          <img
            src={heroDirectory + "/" + mobileHeroSources[0][0]}
            srcSet={sourceSet(mobileHeroSources)}
            sizes="(max-aspect-ratio: 9/16) 56.25svh, 100vw"
            alt=""
            width={480}
            height={853}
            loading="eager"
            fetchPriority="high"
          />
        </picture>
      )}
      <BrandLogo decorative tone="white" className="home-hero-wordmark" />
      <div className="home-shell home-hero-copy">
        <h1 id="hero-heading">Cinematic digital wedding invitations</h1>
        <p>An invitation worth experiencing.</p>
        <div className="home-actions">
          <a
            className="home-button home-button-light"
            href={storefrontRoutes.collection}
          >
            Explore Invitations <span aria-hidden="true">↗</span>
          </a>
          {demoUrl && (
            <a className="home-button home-button-outline" href={demoUrl}>
              View Demo
            </a>
          )}
        </div>
      </div>
      <a
        className="home-hero-cue"
        href="#statement"
        aria-label="Scroll to the statement"
      >
        <svg
          aria-hidden="true"
          width="24"
          height="14"
          viewBox="0 0 24 14"
          fill="none"
        >
          <path
            d="M2 2.5L12 12.5L22 2.5"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        </svg>
      </a>
    </section>
  );
}
