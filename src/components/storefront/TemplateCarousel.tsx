"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { StorefrontTemplate } from "@/lib/storefront-catalogue";

type Slide = StorefrontTemplate["views"][number] & {
  templateId: string;
  name: string;
};

function positions(element: HTMLOListElement) {
  const max = element.scrollWidth - element.clientWidth;
  return Array.from(element.children, (child) =>
    Math.min(max, (child as HTMLElement).offsetLeft),
  );
}
function nearest(element: HTMLOListElement) {
  const points = positions(element);
  return points.reduce(
    (best, point, index) =>
      Math.abs(point - element.scrollLeft) <
      Math.abs(points[best] - element.scrollLeft)
        ? index
        : best,
    0,
  );
}
export function TemplateCarousel({
  collection,
}: {
  collection: readonly StorefrontTemplate[];
}) {
  const slides: Slide[] = collection.flatMap((item) =>
    item.views.map((view) => ({
      ...view,
      templateId: item.templateId,
      name: item.name,
    })),
  );
  const track = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const drag = useRef<{
    pointerId: number;
    x: number;
    scroll: number;
    moving: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  function go(index: number) {
    const element = track.current;
    if (!element || !slides.length) return;
    const next = Math.max(0, Math.min(slides.length - 1, index));
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollTo({
      left: positions(element)[next],
      behavior: reduced ? "instant" : "smooth",
    });
  }
  function key(event: KeyboardEvent<HTMLOListElement>) {
    if (event.target !== event.currentTarget) return;
    const target = {
      ArrowLeft: active - 1,
      ArrowRight: active + 1,
      Home: 0,
      End: slides.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  }
  function startDrag(event: PointerEvent<HTMLOListElement>) {
    suppressClick.current = false;
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      (event.target as Element).closest("a, button")
    )
      return;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      scroll: event.currentTarget.scrollLeft,
      moving: false,
    };
  }
  function moveDrag(event: PointerEvent<HTMLOListElement>) {
    const start = drag.current;
    const element = event.currentTarget;
    if (!start || start.pointerId !== event.pointerId) return;
    if (!start.moving && !(event.buttons & 1)) {
      drag.current = null;
      return;
    }
    const delta = event.clientX - start.x;
    if (!start.moving && Math.abs(delta) < 6) return;
    if (!start.moving) {
      start.moving = true;
      element.setPointerCapture(event.pointerId);
      element.dataset.dragging = "true";
    }
    element.scrollLeft = start.scroll - delta;
  }
  function endDrag(event: PointerEvent<HTMLOListElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!start.moving) return;
    const element = event.currentTarget;
    const target = nearest(element);
    suppressClick.current = true;
    delete element.dataset.dragging;
    go(target);
  }

  useEffect(() => {
    const element = track.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setActive(nearest(element)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!slides.length)
    return (
      <p className="home-empty">The first invitation preview is coming soon.</p>
    );

  return (
    <div
      className="home-carousel"
      role="group"
      aria-label="Invitation previews"
      aria-roledescription="carousel"
    >
      <div className="home-carousel-controls">
        <span className="home-carousel-count" aria-live="polite">
          {active + 1} <span aria-hidden="true">/</span>
          <span className="sr-only"> of </span> {slides.length}
        </span>
        <div>
          <button
            type="button"
            aria-label="Previous preview"
            aria-controls="template-previews"
            aria-disabled={active === 0}
            onClick={() => {
              if (active > 0) go(active - 1);
            }}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next preview"
            aria-controls="template-previews"
            aria-disabled={active === slides.length - 1}
            onClick={() => {
              if (active < slides.length - 1) go(active + 1);
            }}
          >
            →
          </button>
        </div>
      </div>
      <ol
        className="home-carousel-track"
        id="template-previews"
        ref={track}
        tabIndex={0}
        aria-label="Invitation preview slides"
        onKeyDown={key}
        onScroll={({ currentTarget }) => setActive(nearest(currentTarget))}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onClickCapture={(event) => {
          if (suppressClick.current && event.detail) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick.current = false;
          }
        }}
      >
        {slides.map((slide) => (
          <li
            className="home-slide"
            key={slide.id}
            data-template-id={slide.templateId}
            data-view-id={slide.id}
          >
            <div className="home-slide-art" data-view={slide.id}>
              <Image
                src={slide.image}
                alt={slide.alt}
                fill
                sizes="(min-width: 1100px) 600px, (min-width: 760px) 49vw, 80vw"
                draggable={false}
              />
            </div>
            <div className="home-slide-meta">
              <div>
                {collection.length > 1 && <p>{slide.name}</p>}
                <h3>{slide.label}</h3>
              </div>
              <a href={slide.href}>{slide.action}</a>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
