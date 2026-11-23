"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { storefrontRoutes } from "@/lib/storefront-routes";

export function StorefrontHeader({
  studioAvailable,
}: {
  studioAvailable: boolean;
}) {
  const links = [
    { label: "Invitations", href: storefrontRoutes.collection },
    { label: "How it works", href: storefrontRoutes.howItWorks },
    ...(studioAvailable ? [{ label: "Studio", href: "/studio" }] : []),
  ];

  return (
    <header className="home-header">
      <div className="home-shell home-header-row">
        <a
          href={storefrontRoutes.home}
          className="home-header-logo"
          aria-label="YUGMA home"
        >
          <BrandLogo
            decorative
            variant="emblem"
            tone="white"
            className="home-mark-light"
          />
          <BrandLogo
            decorative
            variant="emblem"
            tone="forest"
            className="home-mark-dark"
          />
        </a>
        <nav className="home-desktop-nav" aria-label="Main navigation">
          {links.map(({ label, href }) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <details
          className="home-menu"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !event.currentTarget.open) return;
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }}
        >
          <summary>
            Menu <span aria-hidden="true" className="home-menu-icon" />
          </summary>
          <nav aria-label="Mobile navigation">
            {links.map(({ label, href }) => (
              <a
                href={href}
                key={href}
                onClick={(event) => {
                  const menu = event.currentTarget.closest("details");
                  if (menu) menu.open = false;
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
