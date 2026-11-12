import type { InvitationTemplateProps } from "../types";
import { Cover } from "@/components/invitation/Cover";
import "../heirloom/heirloom.css";
import "./afterglow.css";

export function Afterglow({ invitation }: InvitationTemplateProps) {
  const date = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeZone: invitation.timeZone,
  });
  const time = new Intl.DateTimeFormat("en-IN", {
    timeStyle: "short",
    timeZone: invitation.timeZone,
  });
  return (
    <main className="afterglow-invitation">
      <Cover invitation={invitation} />
      {/* TODO(afterglow): future scroll-driven florals and photo interactions stay template-local. */}
      <section
        className="afterglow-celebration"
        id="celebration"
        aria-labelledby="celebration-title"
      >
        <p className="afterglow-eyebrow">Moments to remember</p>
        <h2 id="celebration-title">Celebrate with us</h2>
        <ul className="afterglow-events">
          {invitation.events.map((event) => (
            <li key={event.id} className="afterglow-event">
              <h3>{event.title}</h3>
              <p>
                <time dateTime={event.startsAt}>
                  {date.format(new Date(event.startsAt))} ·{" "}
                  {time.format(new Date(event.startsAt))}
                </time>
              </p>
              <p className="afterglow-zone">{invitation.timeZone}</p>
              <p className="afterglow-venue">{event.venue.name}</p>
              <p>{event.venue.address}</p>
            </li>
          ))}
        </ul>
      </section>
      <footer className="afterglow-closing">
        <span className="afterglow-ornament" aria-hidden="true">
          ✧
        </span>
        <h2>
          Every beautiful beginning
          <br />
          is better shared.
        </h2>
        <p>We look forward to celebrating with you.</p>
      </footer>
    </main>
  );
}
