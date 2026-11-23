import { BrandLogo } from "@/components/brand/BrandLogo";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import { storefrontRoutes } from "@/lib/storefront-routes";
import { storefrontPhotoReviewEnabled } from "@/lib/home-hero-assets";
import { HomepageHeroSequence } from "./HomepageHeroSequence";
import { StorefrontExperience } from "./StorefrontExperience";
import "./storefront.css";

const steps = [
  {
    title: "Choose an invitation",
    text: "Open Afterglow to explore the cover, ceremony schedule and venue details as a guest would.",
  },
  {
    title: "Make it yours",
    text: "Try your names, dates and venues in the browser. Your demo edits stay on that page.",
  },
  {
    title: "Preview your invitation",
    text: "Review the watermarked invitation with your details. Open Private Studio separately to save a draft when it’s available.",
  },
] as const;

const priceFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
});

export function Storefront({
  photographic = storefrontPhotoReviewEnabled(),
  fontClass = "",
  studioAvailable = false,
  showTestPrice = false,
}: {
  photographic?: boolean;
  fontClass?: string;
  studioAvailable?: boolean;
  showTestPrice?: boolean;
} = {}) {
  const afterglow = getStorefrontCatalogue().find(
    ({ templateId }) => templateId === "afterglow",
  );

  return (
    <StorefrontExperience
      fontClass={fontClass}
      studioAvailable={studioAvailable}
    >
      <main>
        <HomepageHeroSequence
          photographic={photographic}
          demoUrl={afterglow?.demoUrl}
        />
        <section
          className="home-statement"
          id="statement"
          aria-labelledby="statement-heading"
          tabIndex={-1}
        >
          <div className="home-statement-stage home-shell">
            <h2 id="statement-heading" aria-label="More than where and when.">
              <span aria-hidden="true" className="home-word-group">
                <span data-home-word>More</span>{" "}
                <span data-home-word>than</span>
              </span>{" "}
              <span aria-hidden="true" className="home-word-group">
                <span data-home-word>where</span>{" "}
                <span data-home-word>and</span>{" "}
                <span data-home-word>when.</span>
              </span>
            </h2>
          </div>
        </section>
        <section
          className="home-collection"
          id="templates"
          aria-labelledby="collection-heading"
          tabIndex={-1}
        >
          {afterglow ? (
            <div className="home-shell home-feature">
              <div className="home-feature-copy">
                <p className="home-kicker">The YUGMA Collection</p>
                <h2 id="collection-heading">{afterglow.name}</h2>
                <p>{afterglow.description}</p>
                {showTestPrice && afterglow.price.amountMinor !== null && (
                  <p className="home-test-price">
                    {priceFormat.format(afterglow.price.amountMinor / 100)}{" "}
                    one-time in Test Mode
                  </p>
                )}
                <div className="home-actions">
                  <a
                    className="home-button home-button-forest"
                    href={afterglow.demoUrl}
                  >
                    View Live Demo <span aria-hidden="true">↗</span>
                  </a>
                  <a
                    className="home-button home-button-outline"
                    href={afterglow.personalizeUrl}
                  >
                    Personalize
                  </a>
                </div>
              </div>
              <picture className="home-feature-art">
                <source
                  media="(min-width: 820px)"
                  srcSet="/images/storefront/afterglow-editorial-wide.webp"
                  width={768}
                  height={768}
                />
                {/* The responsive stills are captures from the real watermarked Afterglow renderer. */}
                <img
                  src="/images/storefront/afterglow-editorial-portrait.webp"
                  width={430}
                  height={615}
                  alt="Afterglow’s sample cover for Tara and Neel, with the YUGMA Demo watermark."
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
          ) : (
            <div className="home-shell">
              <h2 id="collection-heading">The YUGMA Collection</h2>
              <p>Invitation demos will be available soon.</p>
            </div>
          )}
        </section>
        <section
          className="home-how"
          id="how-it-works"
          aria-labelledby="how-heading"
          tabIndex={-1}
        >
          <div className="home-shell">
            <h2 id="how-heading">How it works</h2>
            <ol role="list">
              {steps.map((step, i) => (
                <li key={step.title}>
                  <span className="home-step-number" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="home-final" aria-labelledby="closing-heading">
          <BrandLogo
            decorative
            tone="white"
            variant="emblem"
            className="home-closing-emblem"
          />
          <h2 id="closing-heading">Give your story a beginning.</h2>
          <a
            className="home-button home-button-light"
            href={storefrontRoutes.catalogue}
          >
            Explore Invitations <span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>
      <footer className="home-footer" id="contact" tabIndex={-1}>
        <div className="home-shell home-footer-row">
          <p>© YUGMA</p>
          <nav aria-label="Footer navigation">
            <a href={storefrontRoutes.catalogue}>Invitation catalogue</a>
            <a href={storefrontRoutes.howItWorks}>How it works</a>
            <a href={storefrontRoutes.publicSupport}>Contact YUGMA on GitHub</a>
          </nav>
        </div>
      </footer>
    </StorefrontExperience>
  );
}
