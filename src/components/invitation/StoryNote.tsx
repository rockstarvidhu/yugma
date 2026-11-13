"use client";

import Image from "next/image";
import { useId, useState } from "react";
import type { Invitation, InvitationImage } from "@/types/invitation";

type StoryNoteProps = Pick<Invitation, "welcomeNote" | "gallery"> & {
  trustedImageOrigin?: string;
};

function localStoryPhoto(photo: InvitationImage, trustedOrigin?: string) {
  if (!trustedOrigin) return undefined;
  try {
    const url = new URL(photo.src);
    const origin = new URL(trustedOrigin).origin;
    if (
      url.origin === origin &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/media\/invitations\/[\w-]+\.(?:avif|jpe?g|png|webp)$/i.test(
        url.pathname,
      )
    ) {
      return url.pathname;
    }
  } catch {
    return undefined;
  }
}

export function StoryNote({
  welcomeNote,
  gallery,
  trustedImageOrigin,
}: StoryNoteProps) {
  const headingId = useId();
  const [failedSource, setFailedSource] = useState<string>();
  const photos = gallery ?? [];
  const photo = photos.find((image) =>
    localStoryPhoto(image, trustedImageOrigin),
  );
  const source = photo && localStoryPhoto(photo, trustedImageOrigin);
  const showPhoto = photo && source && failedSource !== source;
  if (!welcomeNote && !showPhoto) return null;

  return (
    <section className="invitation-story" aria-labelledby={headingId}>
      <h2 id={headingId}>A note from us</h2>
      {welcomeNote && <p className="invitation-note-copy">{welcomeNote}</p>}
      {showPhoto && (
        <figure className="invitation-story-photo">
          <div className="invitation-story-frame">
            <Image
              src={source}
              alt={photo.alt}
              fill
              sizes="(max-width: 40rem) 100vw, 36rem"
              style={{
                objectPosition: photo.focalPosition
                  ? `${photo.focalPosition.x * 100}% ${photo.focalPosition.y * 100}%`
                  : "center",
              }}
              onError={() => setFailedSource(source)}
            />
          </div>
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>
      )}
    </section>
  );
}
