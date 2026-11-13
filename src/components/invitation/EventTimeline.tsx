import { useId } from "react";
import { VenueCard } from "./VenueCard";
import type { Invitation, WeddingEvent } from "@/types/invitation";

type EventTimelineProps = {
  events: readonly WeddingEvent[];
  timeZone: Invitation["timeZone"];
  locale?: string;
  id?: string;
  className?: string;
  showVenues?: boolean;
};

export function EventTimeline({
  events,
  timeZone,
  locale = "en-IN",
  id,
  className,
  showVenues = true,
}: EventTimelineProps) {
  const headingId = useId();
  // Stable sorting preserves invitation order for events at the same instant.
  const orderedEvents = [...events].sort(
    (first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt),
  );
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

  return (
    <section id={id} aria-labelledby={headingId} className={className}>
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <header className="mb-10 text-center sm:mb-14">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-muted">
            The celebration
          </p>
          <h2
            id={headingId}
            className="font-editorial text-3xl leading-tight text-heading sm:text-4xl"
          >
            Celebrate with us
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted [overflow-wrap:anywhere]">
            All times shown in {timeZone}
          </p>
        </header>

        <ol className="divide-y divide-border/70 border-y border-border/70">
          {orderedEvents.map((event) => {
            const startsAt = new Date(event.startsAt);
            return (
              <li
                key={event.id}
                className="grid gap-4 text-left [overflow-wrap:anywhere] py-7 sm:grid-cols-[8rem_1fr] sm:gap-8 sm:py-9"
              >
                <div className="text-sm leading-6 text-muted sm:pt-1">
                  <time dateTime={event.startsAt}>
                    {dateFormatter.format(startsAt)}{" "}
                    <span className="mt-1 block font-medium text-heading">
                      {timeFormatter.format(startsAt)}
                    </span>
                  </time>
                </div>
                <div className="min-w-0">
                  <h3 className="break-words font-editorial text-2xl leading-snug text-heading sm:text-[1.75rem]">
                    {event.title}
                  </h3>
                  {showVenues && (
                    <VenueCard venue={event.venue} location={event.location} />
                  )}
                  {event.description && (
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {event.description}
                    </p>
                  )}
                  {event.dressCode && (
                    <p className="mt-3 text-sm leading-6 text-muted">
                      <span className="font-medium text-heading">Attire:</span>{" "}
                      {event.dressCode}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
