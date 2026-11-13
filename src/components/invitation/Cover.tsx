import { CoverPhoto } from "./CoverPhoto";
import { resolveCoverPhoto } from "@/lib/cover-photo";
import type { Invitation } from "@/types/invitation";

type CoverProps = {
  invitation: Invitation;
};

export function Cover({ invitation }: CoverProps) {
  // The schema has no primary event. Show when the celebrations begin.
  const firstStart = Math.min(
    ...invitation.events.map(({ startsAt }) => Date.parse(startsAt)),
  );
  const coverPhoto = resolveCoverPhoto(invitation.coverImage);
  const weddingDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeZone: invitation.timeZone,
  }).format(firstStart);

  return (
    <header className="heirloom-cover">
      {coverPhoto && <CoverPhoto key={coverPhoto.src} photo={coverPhoto} />}
      <div className="heirloom-cover__veil" aria-hidden="true" />

      <div className="heirloom-cover__content">
        <p className="heirloom-cover__eyebrow">With joy, we invite you</p>
        <h1 className="heirloom-cover__names">
          <span>{invitation.couple.partnerOne}</span>{" "}
          <span className="heirloom-cover__ampersand">&amp;</span>{" "}
          <span>{invitation.couple.partnerTwo}</span>
        </h1>
        <p className="heirloom-cover__date">
          {invitation.events.length > 1 && "Celebrations begin "}
          <time dateTime={new Date(firstStart).toISOString()}>
            {weddingDate}
          </time>
        </p>
      </div>
    </header>
  );
}
