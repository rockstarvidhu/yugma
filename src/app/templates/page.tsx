import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import { storefrontRoutes } from "@/lib/storefront-routes";
import "./catalogue.css";

const title = "Wedding invitation templates";
const description =
  "Explore YUGMA’s digital wedding invitations. View a sample and preview it with your own details.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: storefrontRoutes.catalogue },
  openGraph: {
    title,
    description,
    url: storefrontRoutes.catalogue,
    type: "website",
    images: [
      {
        url: "/brand/yugma-og-brand.png",
        width: 1200,
        height: 630,
        alt: "YUGMA wedding invitations",
      },
    ],
  },
};

const priceFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
});

export default function TemplatesPage() {
  const collection = getStorefrontCatalogue();

  return (
    <div className="yugma-brand catalogue-page min-h-screen">
      <header className="border-forest/20 border-b">
        <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 py-2">
          <BrandLogo href="/" label="YUGMA home" className="w-28 sm:w-36" />
          <Link
            href={storefrontRoutes.howItWorks}
            className="text-forest inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            How it works
          </Link>
        </Container>
      </header>
      <main>
        <Container className="pt-10 pb-16 sm:pt-16 sm:pb-24">
          <div className="catalogue-intro">
            <h1>
              Wedding invitation <em>templates</em>
            </h1>
            <p>
              Give your guests a first glimpse of the day you’re planning
              together. Try a design with your names and details.
            </p>
          </div>
          {collection.length === 0 ? (
            <p className="mt-8">Invitation demos will be available soon.</p>
          ) : (
            <ul
              role="list"
              className="catalogue-list mt-8 grid gap-4 sm:mt-12 sm:gap-8"
            >
              {collection.map((template) => (
                <li
                  key={template.templateId}
                  data-availability={template.availability}
                >
                  <article className="catalogue-card">
                    <div className="catalogue-details">
                      <p className="catalogue-status">Demo available</p>
                      <h2>{template.name}</h2>
                      <p className="catalogue-palette">
                        {template.paletteLabel}
                      </p>
                      <p className="catalogue-description">
                        {template.description}
                      </p>
                      {template.price.amountMinor !== null && (
                        <p className="catalogue-price">
                          <strong>
                            {priceFormat.format(
                              template.price.amountMinor / 100,
                            )}{" "}
                            one-time
                          </strong>{" "}
                          in Test Mode
                        </p>
                      )}
                      <div className="catalogue-actions">
                        <Link
                          href={template.demoUrl}
                          className="catalogue-primary"
                        >
                          Try Demo
                        </Link>
                        <Link
                          href={template.personalizeUrl}
                          className="catalogue-secondary"
                        >
                          Personalize
                        </Link>
                        <Link
                          href={template.heirloomSampleUrl}
                          className="catalogue-secondary"
                        >
                          Heirloom sample
                        </Link>
                      </div>
                    </div>
                    <div className="catalogue-artwork">
                      <Image
                        {...template.preview}
                        alt={template.preview.alt}
                        sizes="(min-width: 1024px) 352px, (min-width: 768px) 43vw, (min-width: 576px) 352px, 82vw"
                      />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </main>
    </div>
  );
}
