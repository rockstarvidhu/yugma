"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { StorefrontHeader } from "./StorefrontHeader";

function interval(progress: number, start: number, end: number) {
  const fraction = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return fraction * fraction * (3 - 2 * fraction);
}

export function StorefrontExperience({
  photographic,
  children,
}: {
  photographic: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    const scene = element?.querySelector<HTMLElement>(".home-moment");
    const stage = element?.querySelector<HTMLElement>(".home-stage");
    const header = element?.querySelector<HTMLElement>(".home-header");
    const photo =
      element?.querySelector<HTMLImageElement>(".home-moment-photo");
    if (!element || !scene || !stage || !header) return;

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
          1 + (desktop.matches ? 0.16 : 0.12) * interval(progress, 0.12, 0.67),
        ),
      );
      element.style.setProperty(
        "--moment-exit",
        `${-16 * interval(progress, 0.64, 1)}%`,
      );
      element.style.setProperty(
        "--moment-title",
        String(
          interval(progress, 0.12, 0.34) * (1 - interval(progress, 0.48, 0.67)),
        ),
      );
      element.style.setProperty(
        "--moment-copy-y",
        `${(1 - interval(progress, 0.12, 0.34)) * 18}px`,
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
        `${39 * (1 - interval(progress, 0.23, 0.88))}svh`,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => {
      animate = photographic && !!photo?.naturalWidth && !reduced.matches;
      element.dataset.motion = animate ? "full" : "static";
      travel = Math.max(1, scene.offsetHeight - stage.offsetHeight);
      update();
    };
    if (!window.matchMedia) return;
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
  }, [photographic]);

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
    <div
      ref={root}
      onClick={navigate}
      className="yugma-brand home-v2"
      data-photographic={photographic}
    >
      <a className="home-skip" href="#templates">
        Skip to collection
      </a>
      <StorefrontHeader />
      {children}
    </div>
  );
}
