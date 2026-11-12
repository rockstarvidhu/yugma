import Image from "next/image";
import type { Invitation } from "@/types/invitation";

type CoverProps = {
  invitation: Invitation;
  detailsId?: string;
};

export function Cover({ invitation, detailsId = "celebration" }: CoverProps) {
  const firstEvent = invitation.events[0];
  const weddingDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeZone: invitation.timeZone,
  }).format(new Date(firstEvent.startsAt));

  return (
    <header className="heirloom-cover">
      {invitation.coverImage && (
        <Image
          className="heirloom-cover__image"
          src={invitation.coverImage.src}
          alt={invitation.coverImage.alt}
          fill
          preload
          sizes="100vw"
          quality={85}
          style={{
            objectPosition: invitation.coverImage.focalPosition
              ? `${invitation.coverImage.focalPosition.x * 100}% ${invitation.coverImage.focalPosition.y * 100}%`
              : "center",
          }}
        />
      )}
      <div className="heirloom-cover__veil" aria-hidden="true" />

      <div className="heirloom-cover__content">
        <p className="heirloom-cover__eyebrow">With joy, we invite you</p>
        <h1 className="heirloom-cover__names">
          <span>{invitation.couple.partnerOne}</span>{" "}
          <span className="heirloom-cover__ampersand">&amp;</span>{" "}
          <span>{invitation.couple.partnerTwo}</span>
        </h1>
        <p className="heirloom-cover__welcome">
          {invitation.welcomeNote ?? "Join us as we begin our life together."}
        </p>
        <p className="heirloom-cover__date">{weddingDate}</p>
      </div>

      <a className="heirloom-cover__scroll" href={`#${detailsId}`}>
        <span>Explore the celebration</span>
        <span className="heirloom-cover__arrow" aria-hidden="true">
          ↓
        </span>
      </a>
    </header>
  );
}
