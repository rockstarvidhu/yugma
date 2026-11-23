"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { StorefrontHeader } from "./StorefrontHeader";

const starts = [0.12, 0.25, 0.38, 0.51, 0.64];
const ramp = 0.18;

export function StorefrontExperience({
  children,
  fontClass,
  studioAvailable,
}: {
  children: ReactNode;
  fontClass: string;
  studioAvailable: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = root.current;
    const hero = page?.querySelector<HTMLElement>(".home-hero");
    const header = page?.querySelector<HTMLElement>(".home-header");
    const scene = page?.querySelector<HTMLElement>(".home-statement");
    const stage = scene?.querySelector<HTMLElement>(".home-statement-stage");
    const words = stage?.querySelectorAll<HTMLElement>("[data-home-word]");
    if (
      !page ||
      !hero ||
      !header ||
      !scene ||
      !stage ||
      !words ||
      !window.matchMedia
    )
      return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let heroEdge = 0;
    let start = 0;
    let travel = 1;
    let light: boolean | undefined;
    let progress = -1;

    function update() {
      frame = 0;
      const position = window.scrollY;
      const nextLight = position >= heroEdge;
      if (page && light !== nextLight) {
        page.dataset.headerTone = nextLight ? "light" : "dark";
        light = nextLight;
      }

      const next = reduced.matches
        ? 1
        : Math.max(0, Math.min(1, (position - start) / travel));
      if (next === progress) return;
      progress = next;
      words?.forEach((word, index) => {
        const amount = Math.max(0, Math.min(1, (next - starts[index]) / ramp));
        word.style.setProperty(
          "--word-opacity",
          String(amount * amount * (3 - 2 * amount)),
        );
      });
    }

    function measure() {
      if (!page || !hero || !header || !scene || !stage) return;
      if (frame) cancelAnimationFrame(frame);
      page.dataset.motion = reduced.matches ? "static" : "scroll";
      start = Math.round(scene.getBoundingClientRect().top + window.scrollY);
      heroEdge =
        hero.getBoundingClientRect().bottom +
        window.scrollY -
        header.offsetHeight;
      travel = Math.max(1, scene.offsetHeight - stage.offsetHeight);
      update();
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(measure)
        : undefined;
    observer?.observe(hero);
    observer?.observe(scene);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    reduced.addEventListener("change", measure);
    measure();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      reduced.removeEventListener("change", measure);
    };
  }, []);

  return (
    <div className={"yugma-brand home-editorial " + fontClass} ref={root}>
      <noscript>
        <style>
          {
            ".home-editorial .home-statement{min-height:0}.home-editorial .home-statement-stage{position:static;min-height:78svh}"
          }
        </style>
      </noscript>
      <a className="home-skip" href="#home">
        Skip to content
      </a>
      <StorefrontHeader studioAvailable={studioAvailable} />
      {children}
    </div>
  );
}
