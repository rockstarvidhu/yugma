import { ClosingNote } from "@/components/invitation/ClosingNote";
import { StoryNote } from "@/components/invitation/StoryNote";
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
        <a className="afterglow-link" href="#celebration">
          The celebration <span aria-hidden="true">↓</span>
        </a>
      </header>
      <StoryNote
        welcomeNote={invitation.welcomeNote}
        gallery={invitation.gallery}
        trustedImageOrigin={
          process.env.SITE_URL ??
          (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : undefined)
        }
      />
      {/* TODO(afterglow): future scroll-driven florals and photo interactions stay template-local. */}
      <EventTimeline
        id="celebration"
        className="afterglow-celebration"
        events={invitation.events}
        timeZone={invitation.timeZone}
      />
      <ClosingNote
        closingNote={invitation.closingNote}
        hosts={invitation.hosts}
      />
    </main>
  );
}
