import type { WeddingEvent } from "@/types/invitation";

type TimelineEvent = Pick<WeddingEvent, "title" | "startsAt"> &
  Partial<
    Pick<
      WeddingEvent,
      "id" | "venue" | "location" | "dressCode" | "description"
    >
  >;

type EventTimelineProps = {
  events: readonly TimelineEvent[];
  timeZone?: string;
  locale?: string;
};

export function EventTimeline({
  events,
  timeZone = "Asia/Kolkata",
  locale = "en-IN",
}: EventTimelineProps) {
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
    <section aria-labelledby="event-timeline-title" className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <header className="mb-10 text-center sm:mb-14">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-muted">
            The celebration
          </p>
          <h2
            id="event-timeline-title"
            className="font-editorial text-3xl leading-tight text-heading sm:text-4xl"
          >
            Join us for every moment
          </h2>
        </header>

        <ol className="divide-y divide-border/70 border-y border-border/70">
          {events.map((event, index) => {
            const startsAt = new Date(event.startsAt);
            const location = event.location ?? event.venue?.name;
            const address = event.venue?.address;

            return (
              <li
                key={event.id ?? `${event.startsAt}-${index}`}
                className="grid gap-4 py-7 sm:grid-cols-[8rem_1fr] sm:gap-8 sm:py-9"
              >
                <div className="text-sm leading-6 text-muted sm:pt-1">
                  <p>{dateFormatter.format(startsAt)}</p>
                  <p className="mt-1 font-medium text-heading">
                    {timeFormatter.format(startsAt)}
                  </p>
                </div>
                <div className="min-w-0">
                  <h3 className="break-words font-editorial text-2xl leading-snug text-heading sm:text-[1.75rem]">
                    {event.title}
                  </h3>
                  {location && (
                    <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                      {location}
                    </p>
                  )}
                  {address && (
                    <p className="mt-0.5 break-words text-sm leading-6 text-muted">
                      {address}
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
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
