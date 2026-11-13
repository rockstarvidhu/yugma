import { ClosingNote } from "@/components/invitation/ClosingNote";
import { Cover } from "@/components/invitation/Cover";
import { EventTimeline } from "@/components/invitation/EventTimeline";
import { StoryNote } from "@/components/invitation/StoryNote";
import { QuickLinks } from "@/components/invitation/QuickLinks";
import { VenueCard } from "@/components/invitation/VenueCard";
import { venueIdentity } from "@/lib/venue-identity";
import type { WeddingEvent } from "@/types/invitation";
import type { InvitationTemplateProps } from "../types";
import "../heirloom/heirloom.css";
import "./afterglow.css";

export function Afterglow({
  invitation,
  trustedImageOrigin,
}: InvitationTemplateProps) {
  const eventsByVenue = new Map<string, WeddingEvent[]>();
  for (const event of invitation.events) {
    const key = venueIdentity(event.venue);
    const events = eventsByVenue.get(key);
    if (events) events.push(event);
    else eventsByVenue.set(key, [event]);
  }

  return (
    <main className="afterglow-invitation">
      {/* TODO(afterglow): envelope opening and cinematic reveals belong inside this template. */}
      <Cover invitation={invitation} />
      <div className="afterglow-navigation">
        <QuickLinks scheduleId="celebration" venueId="venues" />
      </div>
      <StoryNote
        welcomeNote={invitation.welcomeNote}
        gallery={invitation.gallery}
        trustedImageOrigin={trustedImageOrigin}
      />
      {/* TODO(afterglow): future scroll-driven florals and photo interactions stay template-local. */}
      <EventTimeline
        id="celebration"
        className="afterglow-celebration"
        events={invitation.events}
        timeZone={invitation.timeZone}
        showVenues={false}
      />
      <section
        className="afterglow-venues"
        id="venues"
        aria-labelledby="afterglow-venues-heading"
      >
        <h2 id="afterglow-venues-heading">Wedding venues</h2>
        <ul className="afterglow-venue-list" role="list">
          {[...eventsByVenue].map(([key, events]) => (
            <li key={key}>
              <VenueCard venue={events[0].venue} />
              <ul
                className="afterglow-venue-events"
                aria-label="Events at this venue"
                role="list"
              >
                {events.map((event) => (
                  <li key={event.id}>
                    {event.title}
                    {event.location &&
                      event.location !== event.venue.name &&
                      event.location !== event.venue.address && (
                        <span> · {event.location}</span>
                      )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <ClosingNote
        closingNote={invitation.closingNote}
        hosts={invitation.hosts}
      />
    </main>
  );
}
