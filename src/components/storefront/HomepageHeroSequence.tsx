import { storefrontRoutes } from "@/lib/storefront-routes";
import { desktopHeroSources, mobileHeroSources } from "@/lib/home-hero-assets";

const heroDirectory = "/dev/home-hero";

function sourceSet(sources: readonly (readonly [string, number])[]) {
  return sources
    .map(([file, width]) => `${heroDirectory}/${file} ${width}w`)
    .join(", ");
}

export function HomepageHeroSequence({
  photographic,
}: {
  photographic: boolean;
}) {
  return (
    <section
      className="home-moment"
      id="home"
      data-hero-art={photographic ? "photo" : "brand"}
      aria-labelledby="hero-heading"
    >
      <div className="home-stage">
        <div className="home-moment-media" aria-hidden="true">
          {photographic && (
            <picture>
              <source
                media="(min-width: 900px)"
                type="image/webp"
                srcSet={sourceSet(desktopHeroSources)}
                sizes="(max-aspect-ratio: 16/9) 177.78vh, 100vw"
                width={1920}
                height={1080}
              />
              {/* The kit already optimized these art-directed exports. */}
              <img
                className="home-moment-photo"
                src={heroDirectory + "/" + mobileHeroSources[0][0]}
                srcSet={sourceSet(mobileHeroSources)}
                sizes="(max-aspect-ratio: 9/16) 56.25vh, 100vw"
                alt=""
                width={540}
                height={960}
                loading="eager"
                fetchPriority="high"
              />
            </picture>
          )}
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
