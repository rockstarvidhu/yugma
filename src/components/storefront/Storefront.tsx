import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getStorefrontCollection } from "@/lib/storefront-catalogue";
import {
  storefrontNavigation,
  storefrontRoutes,
} from "@/lib/storefront-routes";
import { HomepageHeroSequence } from "./HomepageHeroSequence";
import { StorefrontExperience } from "./StorefrontExperience";
import { TemplateCarousel } from "./TemplateCarousel";
import "./storefront.css";

const steps = [
  {
    title: "Choose a design",
    text: "Open a sample and picture how it could feel for your celebration.",
  },
  {
    title: "Make it yours",
    text: "Try your names, ceremony details and venue in the browser.",
  },
  {
    title: "Preview the invitation",
    text: "See what guests would see in the watermarked demo.",
  },
  {
    title: "Buy and publish",
    text: "Checkout is in Test Mode. Live purchases and publishing are coming later.",
  },
] as const;

export function Storefront({
  photographic = process.env.NODE_ENV === "development",
}: { photographic?: boolean } = {}) {
  const collection = getStorefrontCollection();
  return (
    <StorefrontExperience>
      <main>
        <HomepageHeroSequence photographic={photographic} />
        <section
          className="home-collection"
          id="templates"
          aria-labelledby="collection-heading"
          tabIndex={-1}
        >
          <div className="home-shell">
            <header className="home-collection-head">
              <h2 id="collection-heading">The YUGMA Collection</h2>
              <Link
                className="home-text-link"
                href={storefrontRoutes.catalogue}
              >
                View catalogue
              </Link>
            </header>
            <TemplateCarousel collection={collection} />
          </div>
        </section>
        <section
          className="home-how"
          id="how-it-works"
          aria-labelledby="how-heading"
          tabIndex={-1}
        >
          <div className="home-shell">
            <h2 id="how-heading">How it works</h2>
            <ol>
              {steps.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="home-final" aria-labelledby="closing-heading">
          <BrandLogo decorative tone="sand" variant="emblem" />
          <h2 id="closing-heading">Give your story a beginning.</h2>
          <Link
            className="home-button home-button-light"
            href={storefrontRoutes.catalogue}
          >
            Explore Templates
          </Link>
        </section>
      </main>
      <footer className="home-footer" id="contact" tabIndex={-1}>
        <div className="home-shell home-footer-row">
          <BrandLogo href="/" label="YUGMA home" />
          <nav aria-label="Footer navigation">
            {storefrontNavigation.slice(0, 3).map(({ label, href }) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
          </nav>
          <p>© YUGMA</p>
        </div>
        <p className="home-shell home-footer-note">
          Customer support, terms, privacy and refund policies will be available
          before launch.
        </p>
      </footer>
    </StorefrontExperience>
  );
}
