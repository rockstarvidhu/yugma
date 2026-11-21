"use client";

import Image from "next/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { StorefrontCollectionItem } from "@/lib/storefront-catalogue";

export function TemplateCarousel({
  collection,
}: {
  collection: readonly StorefrontCollectionItem[];
}) {
  if (collection.length === 0)
    return (
      <p className="home-empty">The first invitation preview is coming soon.</p>
    );

  return <TemplateTrack templates={collection} />;
}

function TemplateTrack({
  templates,
}: {
  templates: readonly StorefrontCollectionItem[];
}) {
  const trackId = useId();
  const [active, setActive] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audio = useRef<AudioContext | null>(null);
  const lastBlup = useRef(-Infinity);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const count = templates.length;
  const selected = templates[active];
  const half = Math.floor(count / 2);

  useEffect(() => {
    return () => {
      const context = audio.current;
      audio.current = null;
      if (context) void context.close().catch(() => undefined);
    };
  }, []);

  function unlockAudio() {
    if (!soundEnabled || !window.AudioContext) return;
    const context = (audio.current ??= new AudioContext());
    if (context.state === "suspended")
      void context.resume().catch(() => undefined);
  }

  function playHover(event: PointerEvent<HTMLElement>) {
    const now = performance.now();
    if (
      event.pointerType !== "mouse" ||
      event.buttons !== 0 ||
      !soundEnabled ||
      !window.AudioContext ||
      navigator.userActivation?.hasBeenActive === false ||
      now - lastBlup.current < 170
    )
      return;

    lastBlup.current = now;
    const context = (audio.current ??= new AudioContext());
    const play = () => {
      if (context.state !== "running") return;
      const start = context.currentTime;
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.type = "sine";
      tone.frequency.setValueAtTime(440, start);
      tone.frequency.exponentialRampToValueAtTime(230, start + 0.08);
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.045, start + 0.012);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      tone.connect(volume).connect(context.destination);
      tone.onended = () => {
        tone.disconnect();
        volume.disconnect();
      };
      tone.start(start);
      tone.stop(start + 0.1);
    };
    if (context.state === "running") play();
    else void context.resume().then(play, () => undefined);
  }

  function move(delta: number) {
    setActive((current) => (current + delta + count) % count);
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    switch (event.key) {
      case "ArrowLeft":
        move(-1);
        break;
      case "ArrowRight":
        move(1);
        break;
      case "Home":
        setActive(0);
        break;
      case "End":
        setActive(count - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onPointerDown(event: PointerEvent<HTMLUListElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLUListElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId || event.buttons === 0) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
    const track = event.currentTarget;
    if (!track.hasPointerCapture(event.pointerId))
      track.setPointerCapture(event.pointerId);
    track.dataset.dragging = "true";
    track.style.setProperty(
      "--drag-shift",
      `${Math.max(-30, Math.min(30, dx / 4))}px`,
    );
  }

  function endGesture(event: PointerEvent<HTMLUListElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;
    const track = event.currentTarget;
    suppressClick.current = track.dataset.dragging === "true";
    delete track.dataset.dragging;
    track.style.removeProperty("--drag-shift");
    if (event.type !== "pointerup") return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 32 && Math.abs(dx) > Math.abs(dy)) {
      suppressClick.current = true;
      move(dx < 0 ? 1 : -1);
    }
  }

  return (
    <div
      className="home-carousel"
      role="group"
      aria-label="Invitation previews"
      aria-roledescription="carousel"
      onPointerDownCapture={unlockAudio}
      onKeyDownCapture={unlockAudio}
    >
      <div className="home-carousel-stage">
        <ul
          className="home-carousel-track"
          id={trackId}
          tabIndex={0}
          aria-label="Invitation templates"
          onPointerEnter={playHover}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onLostPointerCapture={(event) => {
            if (event.target === event.currentTarget) endGesture(event);
          }}
          onClickCapture={(event) => {
            if (suppressClick.current && event.detail) {
              suppressClick.current = false;
              event.stopPropagation();
              event.preventDefault();
            }
          }}
        >
          {templates.map((template, index) => {
            const offset = ((index - active + count + half) % count) - half;
            const depth = Math.abs(offset);
            return (
              <li
                className="home-slide"
                key={template.templateId}
                data-template-id={template.templateId}
                data-position={offset}
                hidden={depth > 2}
                style={
                  { "--offset": offset, "--depth": depth } as CSSProperties
                }
              >
                <button
                  type="button"
                  className="home-featured-art"
                  tabIndex={-1}
                  aria-label={`Select ${template.name}`}
                  aria-pressed={index === active}
                  onPointerEnter={playHover}
                  onClick={() => setActive(index)}
                >
                  <Image
                    {...template.preview}
                    alt={template.preview.alt}
                    sizes="(min-width: 1000px) 235px, (min-width: 550px) 25vw, 36vw"
                    draggable={false}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        {count > 1 && (
          <div className="home-carousel-controls">
            <button
              type="button"
              aria-label="Previous template"
              aria-controls={trackId}
              onClick={() => move(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label="Next template"
              aria-controls={trackId}
              onClick={() => move(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
      <div className="home-carousel-footer">
        <div className="home-carousel-caption" key={selected.templateId}>
          <h3>{selected.name}</h3>
          {selected.availability === "demo-available" ? (
            <a
              href={selected.demoUrl}
              aria-label={`Preview Experience: ${selected.name}`}
              className="home-button home-carousel-preview"
            >
              Preview Experience
            </a>
          ) : (
            <p className="home-carousel-status">Coming soon</p>
          )}
        </div>
        <div className="home-carousel-meta">
          <span className="home-carousel-count" aria-hidden="true">
            {active + 1} / {count}
          </span>
          <button
            type="button"
            className="home-carousel-sound"
            aria-label="Carousel sound"
            aria-pressed={soundEnabled}
            onClick={() => setSoundEnabled((enabled) => !enabled)}
          >
            {soundEnabled ? "Sound on" : "Sound off"}
          </button>
        </div>
        <span className="sr-only" aria-live="polite">
          {selected.name}, {active + 1} of {count}.{" "}
          {selected.availability === "coming-soon"
            ? "Coming soon."
            : "Demo available."}
        </span>
      </div>
    </div>
  );
}
