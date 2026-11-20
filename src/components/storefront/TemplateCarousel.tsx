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

function TemplateFeature({ template }: { template: StorefrontTemplate }) {
  return (
    <article className="home-featured" data-template-id={template.templateId}>
      <div className="home-featured-art">
        <Image
          src={template.preview.src}
          alt={template.preview.alt}
          width={template.preview.width}
          height={template.preview.height}
          sizes="(min-width: 1080px) 490px, (min-width: 760px) 45vw, 90vw"
          draggable={false}
        />
      </div>
      <div className="home-featured-copy">
        <h3>{template.name}</h3>
        <p>{template.description}</p>
        {template.availability === "demo-available" ? (
          <a
            href={template.demoUrl}
            aria-label={`Preview Experience: ${template.name}`}
            className="home-button home-featured-action"
          >
            Preview Experience
          </a>
        ) : (
          <p className="home-featured-status">In development</p>
        )}
      </div>
    </article>
  );
}

function positions(element: HTMLUListElement) {
  const max = element.scrollWidth - element.clientWidth;
  return Array.from(element.children, (child) =>
    Math.min(max, (child as HTMLElement).offsetLeft),
  );
}
function nearest(element: HTMLUListElement) {
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
  if (!collection.length)
    return (
      <p className="home-empty">The first invitation preview is coming soon.</p>
    );
  if (collection.length === 1)
    return <TemplateFeature template={collection[0]} />;

  return <TemplateTrack templates={collection} />;
}

function TemplateTrack({
  templates,
}: {
  templates: readonly StorefrontTemplate[];
}) {
  const track = useRef<HTMLUListElement>(null);
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
    if (!element) return;
    const next = Math.max(0, Math.min(templates.length - 1, index));
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollTo({
      left: positions(element)[next],
      behavior: reduced ? "instant" : "smooth",
    });
  }
  function key(event: KeyboardEvent<HTMLUListElement>) {
    if (event.target !== event.currentTarget) return;
    const target = {
      ArrowLeft: active - 1,
      ArrowRight: active + 1,
      Home: 0,
      End: templates.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  }
  function startDrag(event: PointerEvent<HTMLUListElement>) {
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
  function moveDrag(event: PointerEvent<HTMLUListElement>) {
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
  function endDrag(event: PointerEvent<HTMLUListElement>) {
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
          <span className="sr-only"> of </span> {templates.length}
        </span>
        <div>
          <button
            type="button"
            aria-label="Previous template"
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
            aria-label="Next template"
            aria-controls="template-previews"
            aria-disabled={active === templates.length - 1}
            onClick={() => {
              if (active < templates.length - 1) go(active + 1);
            }}
          >
            →
          </button>
        </div>
      </div>
      <ul
        className="home-carousel-track"
        id="template-previews"
        ref={track}
        tabIndex={0}
        aria-label="Invitation templates"
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
        {templates.map((template) => (
          <li className="home-slide" key={template.templateId}>
            <TemplateFeature template={template} />
          </li>
        ))}
      </ul>
    </div>
  );
}
