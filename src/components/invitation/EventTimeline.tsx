import { useId } from "react";
import { weddingVenueSchema } from "@/lib/invitation-schema";
import type { Invitation, WeddingEvent } from "@/types/invitation";

type EventTimelineProps = {
  events: readonly WeddingEvent[];
  timeZone: Invitation["timeZone"];
  locale?: string;
  id?: string;
  className?: string;
};

export function EventTimeline({
  events,
  timeZone,
  locale = "en-IN",
  id,
  className,
}: EventTimelineProps) {
  const headingId = useId();
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
        </header>

        <ol className="divide-y divide-border/70 border-y border-border/70">
          {events.map((event) => {
            const startsAt = new Date(event.startsAt);
            const { name, address, mapsUrl } = event.venue;
            const directions =
              weddingVenueSchema.shape.mapsUrl.safeParse(mapsUrl);

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
                  <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                    {name}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-muted">
                    {address}
                  </p>
                  {event.location && event.location !== name && (
                    <p className="mt-0.5 text-sm leading-6 text-muted">
                      {event.location}
                    </p>
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
                  {directions.success && (
                    <a
                      aria-label={`Get Directions to ${name} (opens in a new tab)`}
                      href={directions.data}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-heading underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                      Get Directions
                    </a>
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
