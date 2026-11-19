"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

import {
  storefrontNavigation as navigation,
  storefrontRoutes,
} from "@/lib/storefront-routes";

export function StorefrontHeader() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    }
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
    <header className="store-header" ref={header}>
      <Container className="store-header-row">
        <BrandLogo
          href="/"
          label="YUGMA home"
          priority
          className="store-logo"
        />
        <nav className="store-desktop-nav" aria-label="Main navigation">
          <ul>
            {navigation.map(({ label, href }) => (
              <li key={href}>
                <Link href={href}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link
          className="store-link-button store-header-cta"
          href={storefrontRoutes.collection}
        >
          Explore Templates
        </Link>
        <Button
          ref={button}
          variant="ghost"
          className="store-menu-toggle"
          aria-expanded={open}
          aria-controls="store-mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close menu" : "Menu"}
          <span
            className={open ? "store-menu-icon is-open" : "store-menu-icon"}
            aria-hidden="true"
          >
            <span />
            <span />
          </span>
        </Button>
      </Container>
      <nav
        id="store-mobile-navigation"
        className="store-mobile-nav"
        hidden={!open}
        aria-label="Mobile navigation"
      >
        <Container>
          <ul>
            {navigation.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} onClick={() => setOpen(false)}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            className="store-link-button"
            href={storefrontRoutes.collection}
            onClick={() => setOpen(false)}
          >
            Explore Templates
          </Link>
        </Container>
      </nav>
    </header>
  );
}
