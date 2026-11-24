"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function StorefrontExperience({
  children,
  review,
}: {
  children: ReactNode;
  review: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const arrival = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = root.current,
      intro = arrival.current;
    if (!page || !intro || !window.matchMedia) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    function dismiss() {
      if (intro) intro.hidden = true;
    }
    try {
      const first = !sessionStorage.getItem("yugma-arrival");
      sessionStorage.setItem("yugma-arrival", "seen");
      if (first && !reduced.matches && !location.hash && window.scrollY < 2) {
        intro.hidden = false;
        timer = setTimeout(dismiss, 1220);
      }
    } catch {
      /* With storage disabled, proceed directly to the invitation collection. */
    }
    window.addEventListener("pointerdown", dismiss, { once: true });
    window.addEventListener("keydown", dismiss, { once: true });
    window.addEventListener("scroll", dismiss, { once: true, passive: true });
    reduced.addEventListener("change", dismiss);
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries)
                if (entry.isIntersecting) {
                  entry.target.classList.add("in-view");
                  observer?.unobserve(entry.target);
                }
            },
            { threshold: 0.12 },
          )
        : null;
    page
      .querySelectorAll("[data-reveal]")
      .forEach((node) => observer?.observe(node));
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("scroll", dismiss);
      reduced.removeEventListener("change", dismiss);
    };
  }, []);
  return (
    <div
      ref={root}
      className="yugma-brand home-editorial"
      data-art={review ? "review" : "brand"}
    >
      <div
        className="home-arrival forest-arrival"
        ref={arrival}
        aria-hidden="true"
        hidden
      >
        <div>
          <BrandLogo
            variant="emblem"
            tone="sand"
            decorative
            className="arrival-emblem"
          />
          <BrandLogo tone="sand" decorative className="arrival-name" />
          <p>Wedding invitations, reimagined</p>
          <i />
        </div>
      </div>
      <a className="home-skip" href="#home">
        Skip to content
      </a>
      {children}
    </div>
  );
}
export function SignatureMarquee() {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el || !window.matchMedia) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    function paint() {
      frame = 0;
      if (!el) return;
      const width = el.firstElementChild?.getBoundingClientRect().width ?? 0;
      const offset =
        reduced.matches || !width ? 0 : (window.scrollY * 0.76) % width;
      el.style.transform = "translate3d(" + -offset + "px,0,0)";
    }
    function update() {
      if (!frame) frame = requestAnimationFrame(paint);
    }
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    reduced.addEventListener("change", update);
    document.fonts?.addEventListener("loadingdone", update);
    paint();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      reduced.removeEventListener("change", update);
      document.fonts?.removeEventListener("loadingdone", update);
    };
  }, []);
  return (
    <div className="signature">
      <p className="sr-only">two lives... one journey...</p>
      <div className="signature-track" ref={track} aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>two lives... one journey...</span>
        ))}
      </div>
    </div>
  );
}
