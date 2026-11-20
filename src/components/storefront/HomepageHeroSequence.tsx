import { storefrontRoutes } from "@/lib/storefront-routes";

const heroDirectory = "/images/home/hero";
const desktopSources = [
  ["hero-desktop-1280x720.webp", 1280],
  ["hero-desktop-1600x900.webp", 1600],
  ["hero-desktop-1920x1080.webp", 1920],
] as const;
const mobileSources = [
  ["hero-mobile-540x960.webp", 540],
  ["hero-mobile-810x1440.webp", 810],
  ["hero-mobile-1080x1920.webp", 1080],
] as const;

function sourceSet(sources: readonly (readonly [string, number])[]) {
  return sources
    .map(([file, width]) => `${heroDirectory}/${file} ${width}w`)
    .join(", ");
}

export function HomepageHeroSequence() {
  return (
    <section className="home-moment" id="home" aria-labelledby="hero-heading">
      <div className="home-stage">
        <div className="home-moment-media" aria-hidden="true">
          <picture>
            <source
              media="(min-width: 900px)"
              type="image/webp"
              srcSet={sourceSet(desktopSources)}
              sizes="(max-aspect-ratio: 16/9) 177.78vh, 100vw"
              width={1920}
              height={1080}
            />
            {/* The kit already optimized these art-directed exports. */}
            <img
              className="home-moment-photo"
              src={heroDirectory + "/hero-mobile-540x960.webp"}
              srcSet={sourceSet(mobileSources)}
              sizes="(max-aspect-ratio: 9/16) 56.25vh, 100vw"
              alt=""
              width={540}
              height={960}
              loading="eager"
              fetchPriority="high"
            />
          </picture>
        </div>
        <div className="home-moment-shade" aria-hidden="true" />
        <div className="home-moment-copy">
          <h1 id="hero-heading">
            Some moments <br />
            deserve <em>more.</em>
          </h1>
          <p>
            Beautifully crafted digital invitations, made to tell your story.
          </p>
          <a
            className="home-button home-button-light"
            href={storefrontRoutes.collection}
          >
            Explore Templates
          </a>
        </div>
        <a className="home-moment-cue" href={storefrontRoutes.collection}>
          Scroll to discover <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}
