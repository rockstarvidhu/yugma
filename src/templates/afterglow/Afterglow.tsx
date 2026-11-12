import { EventTimeline } from "@/components/invitation/EventTimeline";
import type { InvitationTemplateProps } from "../types";
import "./afterglow.css";

export function Afterglow({ invitation }: InvitationTemplateProps) {
  return (
    <main className="afterglow-invitation">
      {/* TODO(afterglow): envelope opening and cinematic reveals belong inside this template. */}
      <header className="afterglow-cover">
        <p className="afterglow-eyebrow">
          Afterglow · A celebration of togetherness
        </p>
        <span className="afterglow-ornament" aria-hidden="true">
          ✧
        </span>
        <h1>
          {invitation.couple.partnerOne}{" "}
          <span className="afterglow-ampersand">&amp;</span>{" "}
          {invitation.couple.partnerTwo}
        </h1>
        {invitation.welcomeNote && (
          <p className="afterglow-welcome">{invitation.welcomeNote}</p>
        )}
        <a className="afterglow-link" href="#celebration">
          The celebration <span aria-hidden="true">↓</span>
        </a>
      </header>
      {/* TODO(afterglow): future scroll-driven florals and photo interactions stay template-local. */}
      <EventTimeline
        id="celebration"
        className="afterglow-celebration"
        events={invitation.events}
        timeZone={invitation.timeZone}
      />
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
