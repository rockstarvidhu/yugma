"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { StorefrontHeader } from "./StorefrontHeader";

function interval(progress: number, start: number, end: number) {
  const fraction = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return fraction * fraction * (3 - 2 * fraction);
}

export function StorefrontExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    const scene = element?.querySelector<HTMLElement>(".home-moment");
    const stage = element?.querySelector<HTMLElement>(".home-stage");
    const header = element?.querySelector<HTMLElement>(".home-header");
    const photo =
      element?.querySelector<HTMLImageElement>(".home-moment-photo");
    if (!element || !scene || !stage || !header || !window.matchMedia) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 900px)");
    let frame = 0;
    let travel = 1;
    let animate = false;
    let nav: boolean | undefined;
    const update = () => {
      frame = 0;
      const top = scene.getBoundingClientRect().top;
      const progress = Math.max(0, Math.min(1, -top / travel));
      const sand = animate
        ? progress >= 0.93
        : scene.getBoundingClientRect().bottom <= header.offsetHeight;
      if (nav !== sand) {
        nav = sand;
        element.dataset.sand = String(sand);
      }
      if (!animate) return;
      element.style.setProperty("--moment-progress", progress.toFixed(4));
      element.style.setProperty(
        "--moment-zoom",
        String(
          1 + (desktop.matches ? 0.09 : 0.08) * interval(progress, 0.15, 0.55),
        ),
      );
      element.style.setProperty(
        "--moment-exit",
        `${-29 * interval(progress, 0.38, 0.86)}%`,
      );
      element.style.setProperty(
        "--moment-title",
        String(
          interval(progress, 0.15, 0.38) * (1 - interval(progress, 0.48, 0.66)),
        ),
      );
      element.style.setProperty(
        "--moment-copy-y",
        `${(1 - interval(progress, 0.15, 0.38)) * 18}px`,
      );
      element.style.setProperty(
        "--moment-cue",
        String(1 - interval(progress, 0.1, 0.27)),
      );
      element.style.setProperty(
        "--moment-departure",
        String(1 - interval(progress, 0.91, 1)),
      );
      element.style.setProperty(
        "--collection-delay",
        `${35 * (1 - interval(progress, 0.3, 0.88))}svh`,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => {
      if (photo && !photo.complete && !photo.naturalWidth && !reduced.matches)
        return;
      animate = Boolean(photo?.naturalWidth) && !reduced.matches;
      element.dataset.motion = animate ? "full" : "static";
      travel = Math.max(1, scene.offsetHeight - stage.offsetHeight);
      update();
    };
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : undefined;
    observer?.observe(scene);
    photo?.addEventListener("load", measure);
    photo?.addEventListener("error", measure);
    reduced.addEventListener("change", measure);
    desktop.addEventListener("change", measure);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      photo?.removeEventListener("load", measure);
      photo?.removeEventListener("error", measure);
      reduced.removeEventListener("change", measure);
      desktop.removeEventListener("change", measure);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
    };
  }, []);

  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("a");
    if (
      !link ||
      !["#templates", "/#templates"].includes(link.getAttribute("href") ?? "")
    )
      return;
    const element = root.current;
    const destination = element?.querySelector<HTMLElement>("#templates");
    const header = element?.querySelector<HTMLElement>(".home-header");
    if (!element || !destination || !header) return;

    event.preventDefault();
    // offsetTop excludes the collection’s introductory transform.
    const documentTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: documentTop + destination.offsetTop - header.offsetHeight,
      behavior: "instant",
    });
    destination.focus({ preventScroll: true });
    if (location.hash !== "#templates")
      history.pushState(null, "", "#templates");
  }

  return (
    <div ref={root} onClick={navigate} className="yugma-brand home-v2">
      <a className="home-skip" href="#templates">
        Skip to collection
      </a>
      <StorefrontHeader />
      {children}
    </div>
  );
}
