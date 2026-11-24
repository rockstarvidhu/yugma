import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import {
  reviewArtBase,
  storefrontPhotoReviewEnabled,
} from "@/lib/home-hero-assets";
import { HomepageHeroSequence } from "./HomepageHeroSequence";
import { SignatureMarquee, StorefrontExperience } from "./StorefrontExperience";
import {
  InvitationCollection,
  type CollectionEntry,
} from "./InvitationCollection";
import { StorefrontHeader } from "./StorefrontHeader";
import "./storefront.css";

const concepts = ["Heritage", "Serenity"].map((name) => ({
  id: name.toLowerCase(),
  name,
  preview: {
    src: reviewArtBase + "/" + name.toLowerCase() + "-art.svg",
    alt: "",
    width: 360,
    height: 510,
  },
}));
export function Storefront({
  photographic = storefrontPhotoReviewEnabled(),
  studioAvailable = false,
  reviewPrices = {},
  supportEmail,
}: {
  photographic?: boolean;
  studioAvailable?: boolean;
  reviewPrices?: Record<string, number>;
  supportEmail?: string;
} = {}) {
  const designs = getStorefrontCatalogue();
  const entries: CollectionEntry[] = designs.map((item) => ({
    id: item.templateId,
    name: item.name,
    preview: item.preview,
    detail: "#design-" + item.templateId,
  }));
  if (photographic && entries.length)
    entries.push(
      ...concepts.filter(
        (concept) => !entries.some((entry) => entry.id === concept.id),
      ),
    );
  const first = designs[0];
  const start =
    studioAvailable && first
      ? "/create/" + first.templateId
      : (first?.personalizeUrl ?? "/templates");
  return (
    <StorefrontExperience review={photographic}>
      <StorefrontHeader startUrl={start} />
      <main>
        <HomepageHeroSequence
          photographic={photographic}
          demoUrl={first?.demoUrl}
        />
        <section
          className="home-purpose"
          id="statement"
          aria-labelledby="purpose-heading"
          tabIndex={-1}
        >
          {photographic && (
            <picture className="purpose-art">
              <source
                media="(max-width: 680px)"
                srcSet={reviewArtBase + "/arch-portrait.webp"}
              />
              <img
                alt=""
                src={reviewArtBase + "/story-right.webp"}
                width={1448}
                height={1086}
                loading="lazy"
              />
            </picture>
          )}
          <div data-reveal>
            <p className="eyebrow">Our purpose</p>
            <h2 id="purpose-heading">
              Wedding invitations that feel <em>personal,</em> cinematic and{" "}
              <em>yours.</em>
            </h2>
            <span className="editorial-rule" />
            <p className="purpose-description">
              Thoughtfully designed digital invitations for modern celebrations,
              rooted in timeless emotion.
            </p>
          </div>
        </section>
        <InvitationCollection entries={entries} />
        {designs.map((item, index) => (
          <section
            key={item.templateId}
            className="home-product"
            id={"design-" + item.templateId}
            aria-labelledby={"heading-" + item.templateId}
          >
            <div className="product-art">
              {photographic && (
                <Image
                  unoptimized
                  className="product-scene"
                  src={reviewArtBase + "/detail-left.webp"}
                  alt=""
                  width={1448}
                  height={1086}
                  loading="lazy"
                />
              )}
              <Image
                className="product-cover"
                {...item.preview}
                alt={item.preview.alt}
                sizes="(max-width:680px) 29vw, 11vw"
                unoptimized
              />
            </div>
            <div className="product-main" data-reveal>
              <p className="eyebrow">
                Signature invitation / {String(index + 1).padStart(3, "0")}
              </p>
              <h2 id={"heading-" + item.templateId}>{item.name}</h2>
              <p>{item.description}</p>
              <span className="editorial-rule" />
              {photographic &&
              studioAvailable &&
              Number.isSafeInteger(reviewPrices[item.templateId]) ? (
                <>
                  <p className="product-availability">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: item.price.currency,
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 0,
                    }).format(reviewPrices[item.templateId] / 100)}
                  </p>
                  <small>One-time test payment. No money is charged.</small>
                </>
              ) : (
                <>
                  <p className="product-availability">Demo available</p>
                  <small>Public purchases haven’t opened yet.</small>
                </>
              )}
            </div>
            <ul className="product-features">
              {item.features.map(([name, text], i) => (
                <li key={name}>
                  <svg
                    width="23"
                    height="23"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.15"
                    aria-hidden="true"
                  >
                    {i === 0 ? (
                      <>
                        <rect x="2.5" y="4" width="19" height="15" rx="1" />
                        <path d="m3 17 6-6 4 3 3-3 5 5" />
                        <circle cx="16" cy="8.5" r="1.3" />
                      </>
                    ) : i === 1 ? (
                      <>
                        <rect x="3" y="5" width="18" height="16" rx="1.5" />
                        <path d="M7 2v6m10-6v6M3 10h18m-14 4h3m3 0h3" />
                      </>
                    ) : (
                      <>
                        <path d="M19.5 10c0 5-7.5 12-7.5 12S4.5 15 4.5 10a7.5 7.5 0 0 1 15 0Z" />
                        <circle cx="12" cy="10" r="2.6" />
                      </>
                    )}
                  </svg>
                  <div>
                    <strong>{name}</strong>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="home-actions product-actions">
              <a className="home-button forest" href={item.demoUrl}>
                ▷　View Live Demo
              </a>
              <a
                className="home-button outline"
                href={
                  studioAvailable
                    ? "/create/" + item.templateId
                    : item.personalizeUrl
                }
              >
                Personalize <span aria-hidden="true">→</span>
              </a>
            </div>
          </section>
        ))}
      </main>
      <footer className="home-footer" id="contact">
        <div className="footer-information">
          <div>
            <BrandLogo
              tone="sand"
              href="/"
              label="YUGMA home"
              className="footer-wordmark"
            />
            <p>Digital wedding invitations</p>
          </div>
          <div id="how-it-works">
            <h2>How it works</h2>
            <p>
              Explore a sample, try your details, then preview your invitation.
            </p>
          </div>
          <nav aria-label="Footer navigation">
            <h2>Explore</h2>
            <a href="/templates">Invitation catalogue</a>
            <Link href="/studio" prefetch={false}>
              Private Studio
            </Link>
          </nav>
          <div>
            <h2>Invitation help</h2>
            {supportEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? (
              <a href={"mailto:" + supportEmail}>{supportEmail}</a>
            ) : (
              <p>
                For invitation changes, open your saved draft in{" "}
                <Link href="/studio" prefetch={false}>
                  Studio
                </Link>
                . Guests can contact their wedding hosts.
              </p>
            )}
          </div>
        </div>
        <SignatureMarquee />
      </footer>
    </StorefrontExperience>
  );
}
