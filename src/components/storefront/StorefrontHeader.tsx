"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  storefrontNavigation,
  storefrontRoutes,
} from "@/lib/storefront-routes";

export function StorefrontHeader() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 900px)");
    const resize = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", resize);
    };
  }, [open]);

  return (
    <header className="home-header" ref={header}>
      <div className="home-header-row">
        <Link href="/" className="home-header-logo" aria-label="YUGMA home">
          <BrandLogo decorative tone="white" className="home-mark-light" />
          <BrandLogo decorative tone="forest" className="home-mark-dark" />
        </Link>
        <nav className="home-desktop-nav" aria-label="Main navigation">
          {storefrontNavigation.slice(1, 3).map(({ label, href }) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <a className="home-header-cta" href={storefrontRoutes.collection}>
          Skip intro
        </a>
        <button
          type="button"
          className="home-menu-toggle"
          ref={button}
          aria-expanded={open}
          aria-controls="home-mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close menu" : "Menu"}
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
      </div>
      <nav
        className="home-mobile-nav"
        id="home-mobile-nav"
        aria-label="Mobile navigation"
        hidden={!open}
      >
        {storefrontNavigation.slice(0, 3).map(({ label, href }) => (
          <a href={href} key={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
