import { BrandLogo } from "@/components/brand/BrandLogo";
import { reviewArtBase } from "@/lib/home-hero-assets";
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
            media="(min-aspect-ratio: 1/1)"
            srcSet={reviewArtBase + "/hero-wide.webp"}
            width={1672}
            height={941}
          />
          <img
            src={reviewArtBase + "/hero-portrait.webp"}
            alt=""
            width={941}
            height={1672}
            loading="eager"
            fetchPriority="high"
          />
        </picture>
      )}
      <BrandLogo decorative tone="sand" className="home-hero-wordmark" />
      <div className="home-hero-copy">
        <h1 id="hero-heading">
          Cinematic digital
          <br /> wedding invitations
        </h1>
        <p>An invitation worth experiencing.</p>
        <div className="home-actions">
          <a className="home-button ivory" href="#templates">
            Explore Invitations <span aria-hidden="true">⟶</span>
          </a>
          {demoUrl && (
            <a className="home-button outline" href={demoUrl}>
              <span aria-hidden="true">▷</span> View Demo
            </a>
          )}
        </div>
      </div>
      <a
        className="home-hero-cue"
        href="#statement"
        aria-label="Scroll to our purpose"
      >
        <svg
          viewBox="0 0 32 18"
          width="32"
          height="18"
          fill="none"
          aria-hidden="true"
        >
          <path d="M1 1l15 15L31 1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </a>
    </section>
  );
}
