"use client";

import Image from "next/image";
import { useState } from "react";
import type { InvitationImage } from "@/types/invitation";

export function CoverPhoto({ photo }: { photo: InvitationImage }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  if (status === "failed") return null;

  const { src, alt, focalPosition } = photo;
  return (
    <Image
      className="heirloom-cover__image"
      src={src}
      alt={alt}
      fill
      preload
      sizes="100vw"
      quality={85}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("failed")}
      style={{
        visibility: status === "loaded" ? "visible" : "hidden",
        objectPosition: focalPosition
          ? `${focalPosition.x * 100}% ${focalPosition.y * 100}%`
          : "center",
      }}
    />
  );
}
