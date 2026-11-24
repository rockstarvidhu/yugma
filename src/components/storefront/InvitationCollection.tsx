"use client";
import Image from "next/image";
import { useRef, useState } from "react";

export type CollectionEntry = {
  id: string;
  name: string;
  preview: { src: string; alt: string; width: number; height: number };
  detail?: string;
};
export function InvitationCollection({
  entries,
}: {
  entries: CollectionEntry[];
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const multi = entries.length > 1;
  function go(index: number) {
    const el = rail.current;
    if (!el) return;
    const target = el.children[index] as HTMLElement | undefined;
    if (!target) return;
    const left = target.offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
    el.scrollTo({
      left,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function sync() {
    const el = rail.current;
    if (!el || !el.children.length) return;
    const origin = (el.children[0] as HTMLElement).offsetLeft + el.scrollLeft;
    let nearest = 0;
    for (let i = 1; i < entries.length; i++) {
      if (
        Math.abs((el.children[i] as HTMLElement).offsetLeft - origin) <
        Math.abs((el.children[nearest] as HTMLElement).offsetLeft - origin)
      )
        nearest = i;
    }
    setActive(nearest);
  }
  return (
    <section
      id="templates"
      className="home-collection"
      aria-labelledby="collection-heading"
      tabIndex={-1}
    >
      <div className="collection-light" aria-hidden="true" />
      <div className="collection-flowers" aria-hidden="true" />
      <div className="collection-intro" data-reveal>
        <p className="eyebrow">The collection</p>
        <h2 id="collection-heading">
          Signature invitations for your celebration.
        </h2>
      </div>
      {entries.length > 0 ? (
        <div className="collection-display">
          <div
            className="collection-rail"
            ref={rail}
            aria-label="Invitation designs"
            role="region"
            aria-roledescription={multi ? "carousel" : undefined}
            tabIndex={multi ? 0 : undefined}
            onScroll={sync}
            onKeyDown={(e) => {
              if (!multi) return;
              const targets: Record<string, number> = {
                ArrowRight: Math.min(active + 1, entries.length - 1),
                ArrowLeft: Math.max(0, active - 1),
                Home: 0,
                End: entries.length - 1,
              };
              if (Object.hasOwn(targets, e.key)) {
                e.preventDefault();
                go(targets[e.key]);
              }
            }}
          >
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className="collection-slide"
                data-selected={active === i}
                role="group"
                aria-label={
                  entry.name + ", " + (i + 1) + " of " + entries.length
                }
              >
                {entry.detail ? (
                  <a
                    className="collection-art"
                    href={entry.detail}
                    aria-label={"Explore " + entry.name}
                  >
                    <Image
                      {...entry.preview}
                      alt={entry.preview.alt}
                      sizes="(max-width: 680px) 59vw, 23vw"
                      unoptimized
                    />
                  </a>
                ) : (
                  <div className={"collection-art concept concept-" + entry.id}>
                    <Image
                      {...entry.preview}
                      alt=""
                      sizes="(max-width: 680px) 59vw, 23vw"
                      unoptimized
                    />
                    <div>
                      <em>{entry.name}</em>
                      <small>Coming soon</small>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="collection-caption">
            <div aria-live="polite" aria-atomic="true">
              <em>{entries[active]?.name}</em>
              <span>
                {entries[active]?.detail
                  ? "Signature invitation"
                  : "Review concept"}
              </span>
            </div>
            {multi && (
              <div className="collection-controls">
                <button
                  type="button"
                  onClick={() => go(active - 1)}
                  disabled={active === 0}
                  aria-label="Previous invitation"
                >
                  ←
                </button>
                <span>
                  {active + 1} / {entries.length}
                </span>
                <button
                  type="button"
                  onClick={() => go(active + 1)}
                  disabled={active === entries.length - 1}
                  aria-label="Next invitation"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p>Invitation demos will be available soon.</p>
      )}
    </section>
  );
}
