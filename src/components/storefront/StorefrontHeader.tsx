"use client";
import { BrandLogo } from "@/components/brand/BrandLogo";
export function StorefrontHeader({ startUrl }: { startUrl: string }) {
  const links = [
    ["Templates", "/#templates"],
    ["Studio", "/studio"],
    ["Sign in", "/sign-in"],
    ["Get started", startUrl],
  ];
  const nav = links.map(([name, url]) => (
    <a
      key={name}
      href={url}
      className={name === "Get started" ? "home-start" : undefined}
    >
      {name}
    </a>
  ));
  return (
    <header className="home-header">
      <BrandLogo
        href="/"
        label="YUGMA home"
        tone="sand"
        className="home-header-wordmark"
      />
      <nav className="home-desktop-nav" aria-label="Main navigation">
        {nav}
      </nav>
      <details
        className="home-menu"
        onKeyDown={(e) => {
          if (e.key === "Escape" && e.currentTarget.open) {
            e.currentTarget.open = false;
            e.currentTarget.querySelector("summary")?.focus();
          }
        }}
      >
        <summary>
          Menu <span aria-hidden="true">☰</span>
        </summary>
        <nav
          aria-label="Mobile navigation"
          onClick={(e) => {
            if ((e.target as Element).closest("a"))
              e.currentTarget.closest("details")!.open = false;
          }}
        >
          {nav}
        </nav>
      </details>
    </header>
  );
}
