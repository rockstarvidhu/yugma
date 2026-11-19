import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getStorefrontCollection } from "@/lib/storefront-catalogue";
import { storefrontRoutes } from "@/lib/storefront-routes";
import { StorefrontHeader } from "./StorefrontHeader";
import "./storefront.css";

export function Storefront() {
  const collection = getStorefrontCollection();
  const sample = collection.find(
    (item) => item.availability === "demo-available",
  );
  return (
    <div className="yugma-brand storefront">
      <a className="store-skip" href="#main-content">
        Skip to content
      </a>
      <StorefrontHeader />
      <main id="main-content" tabIndex={-1}>
        <section
          className="store-hero"
          id="home"
          aria-labelledby="hero-heading"
          tabIndex={-1}
        >
          <Container className="store-hero-grid">
            <div className="store-hero-copy">
              <p className="store-eyebrow">For the beginning of your forever</p>
              <h1 id="hero-heading">
                Some moments deserve <em>more than an invitation.</em>
              </h1>
              <p className="store-hero-description">
                Beautifully crafted digital invitations that bring your wedding
                story to life.
              </p>
              <div className="store-actions">
                <Link
                  className="store-link-button"
                  href={storefrontRoutes.collection}
                >
                  Explore Templates
                </Link>
                {sample && (
                  <Link className="store-text-link" href={sample.demoUrl}>
                    Try a Demo
                  </Link>
                )}
              </div>
              <p className="store-hero-note">
                Made for your story. Shared with your people.
              </p>
            </div>
            <figure className="store-hero-art">
              {/* Temporary supplied art explicitly approved by the owner on 19 Nov 2026. See docs/storefront/assets.md. */}
              <div className="store-hero-photo">
                <Image
                  src="/images/storefront/hands-temporary.webp"
                  alt="An Indian couple joining hands in the warmth of golden-hour light"
                  fill
                  sizes="(min-width: 1200px) 500px, (min-width: 900px) 42vw, (min-width: 600px) 70vw, 90vw"
                  quality={75}
                  preload
                />
              </div>
              <figcaption>
                <span>Two lives. One journey.</span>
                <BrandLogo
                  variant="emblem"
                  decorative
                  className="store-photo-emblem"
                />
              </figcaption>
            </figure>
          </Container>
        </section>

        <section
          className="store-collection store-section"
          id="templates"
          aria-labelledby="collection-heading"
          tabIndex={-1}
        >
          <Container>
            <div className="store-section-intro">
              <SectionHeading
                title="The YUGMA collection"
                eyebrow="An invitation that feels like you"
                id="collection-heading"
              >
                <p>
                  Find a beginning that feels like yours. Explore our first
                  sample and try your own details.
                </p>
              </SectionHeading>
              <p className="store-availability-note">
                Samples are ready to explore.
                <br />
                Purchasing and publication are not open yet.
              </p>
            </div>
            <ul
              className="store-collection-list"
              aria-label="Template collection"
            >
              {collection.map((template) => (
                <li
                  className="store-template"
                  key={template.templateId}
                  data-template-id={template.templateId}
                >
                  <div className="store-template-art">
                    <Image
                      src={template.preview.src}
                      alt={template.preview.alt}
                      width={template.preview.width}
                      height={template.preview.height}
                      sizes="(min-width: 900px) 500px, 90vw"
                    />
                  </div>
                  <div className="store-template-copy">
                    <span className="store-template-status">
                      Sample available
                    </span>
                    <h3>{template.name}</h3>
                    <p>{template.description}</p>
                    <dl className="store-template-spec">
                      <div>
                        <dt>Palette</dt>
                        <dd>{template.paletteLabel}</dd>
                      </div>
                      <div>
                        <dt>Feeling</dt>
                        <dd>{template.moodLabel}</dd>
                      </div>
                    </dl>
                    <Link
                      className="store-link-button store-secondary"
                      href={template.demoUrl}
                    >
                      View {template.name} Sample
                    </Link>
                    <p className="store-purchase-note">
                      Preview your details in the sample. Purchasing is not
                      available yet.
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {!collection.length && (
              <p>
                Our template collection is in development. Please check back for
                a sample.
              </p>
            )}
          </Container>
        </section>

        <section
          className="store-how store-section"
          id="how-it-works"
          aria-labelledby="how-heading"
          tabIndex={-1}
        >
          <Container>
            <SectionHeading
              title="Your story, thoughtfully told."
              eyebrow="How it works"
              id="how-heading"
              align="center"
            >
              <p>
                A little inspiration. A few personal touches.
                <br />A beginning that belongs to you.
              </p>
            </SectionHeading>
            <ol className="store-steps">
              <li>
                <h3>Choose a design</h3>
                <p>
                  Explore a sample invitation and find the feeling for your
                  celebration.
                </p>
              </li>
              <li>
                <h3>Make it personal</h3>
                <p>
                  Try your names, ceremony details and venue in a temporary
                  browser preview.
                </p>
              </li>
              <li>
                <h3>Preview, then share</h3>
                <p>
                  Preview your invitation today. Sharing comes after
                  publication, which is not available yet.
                </p>
              </li>
            </ol>
          </Container>
        </section>

        <section
          className="store-final store-section"
          aria-labelledby="final-heading"
        >
          <Container>
            <BrandLogo
              variant="emblem"
              tone="sand"
              decorative
              className="store-final-emblem"
            />
            <h2 id="final-heading">
              Your forever starts
              <br />
              with a <em>beautiful beginning.</em>
            </h2>
            <p>Let your invitation be the first chapter.</p>
            <Link
              className="store-link-button"
              href={storefrontRoutes.collection}
            >
              Explore Templates
            </Link>
          </Container>
        </section>
      </main>
      <footer className="store-footer">
        <Container>
          <div className="store-footer-grid">
            <div>
              <BrandLogo
                tone="forest"
                href="/"
                label="YUGMA home"
                className="store-footer-logo"
              />
              <p>Two lives. One journey.</p>
            </div>
            <nav aria-label="Footer navigation">
              <h2>Explore</h2>
              <ul>
                <li>
                  <Link href={storefrontRoutes.home}>Home</Link>
                </li>
                <li>
                  <Link href={storefrontRoutes.collection}>Templates</Link>
                </li>
                <li>
                  <Link href={storefrontRoutes.howItWorks}>How It Works</Link>
                </li>
                {sample && (
                  <li>
                    <Link href={sample.demoUrl}>Try a Demo</Link>
                  </li>
                )}
              </ul>
            </nav>
            <div id="contact" tabIndex={-1}>
              <h2>Contact</h2>
              <p>
                Customer enquiries are not open yet.
                <br />
                Contact details will be available at launch.
              </p>
            </div>
          </div>
          <div className="store-footer-bottom">
            <p>© YUGMA</p>
            <p>Thoughtfully crafted digital invitations.</p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
