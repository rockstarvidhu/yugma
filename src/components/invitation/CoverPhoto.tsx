"use client";

import Image from "next/image";
import { useState } from "react";
import type { CoverPhotoSource } from "@/lib/cover-photo";

export function CoverPhoto({
  photo,
  privateAsset = false,
  onUnavailable,
}: {
  photo: CoverPhotoSource;
  privateAsset?: boolean;
  onUnavailable?: () => void;
}) {
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
      preload={!privateAsset}
      sizes="100vw"
      quality={privateAsset ? undefined : 85}
      unoptimized={privateAsset}
      onLoad={() => setStatus("loaded")}
      onError={() => {
        setStatus("failed");
        onUnavailable?.();
      }}
      style={{
        visibility: status === "loaded" ? "visible" : "hidden",
        objectPosition: focalPosition
          ? `${focalPosition.x * 100}% ${focalPosition.y * 100}%`
          : "center",
      }}
    />
  );
}
