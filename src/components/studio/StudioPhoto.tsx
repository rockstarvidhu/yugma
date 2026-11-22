"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  draftMediaPath,
  IMAGE_TYPES,
  privatePhotoId,
  privatePhotoReference,
} from "@/lib/media/contract";
import { uploadPrivatePhoto } from "@/lib/media/upload-client";
import type { InvitationDraft } from "@/lib/invitation-schema";
import { StudioField } from "./StudioField";

type Photo = InvitationDraft["coverImage"];

export function StudioPhoto({
  draftId,
  photo,
  available,
  disabled,
  issues,
  onChange,
  onBusy,
}: {
  draftId: string;
  photo?: Photo;
  available: boolean;
  disabled: boolean;
  issues: Record<string, string>;
  onChange: (photo?: Photo) => void;
  onBusy: (busy: boolean) => void;
}) {
  const running = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | "verifying">();
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [failedAsset, setFailedAsset] = useState<string>();
  const id = privatePhotoId(photo?.src);
  const fieldIssues = {
    ...issues,
    "coverImage.alt": issues["coverImage.alt"] ?? issues["coverImage.src"],
  };

  useEffect(() => () => running.current?.abort(), []);

  async function select(file?: File) {
    if (!file || running.current) return;
    const controller = new AbortController();
    running.current = controller;
    onBusy(true);
    setProgress(0);
    setFailure("");
    setNotice("");
    try {
      const id = await uploadPrivatePhoto(
        draftId,
        file,
        controller.signal,
        setProgress,
      );
      controller.signal.throwIfAborted();
      onChange({ src: privatePhotoReference(id), alt: "Wedding photograph" });
      setNotice("Photo ready. Save the draft to keep it.");
    } catch (error) {
      if (controller.signal.aborted) setNotice("Upload cancelled.");
      else
        setFailure(
          error instanceof Error ? error.message : "Couldn’t upload the photo.",
        );
    } finally {
      running.current = null;
      onBusy(false);
      setProgress(undefined);
    }
  }

  return (
    <fieldset className="studio-events" disabled={disabled}>
      <legend>Cover photograph</legend>
      <p id="studio-photo-help" className="text-sm">
        Optional. Use a JPEG, PNG or WebP photo up to 5 MB. Add a short
        description for guests using a screen reader.
      </p>
      {id && photo && (
        <div className="grid gap-3">
          {failedAsset === id ? (
            <p role="status">
              The saved photo couldn’t be displayed. Reload Studio to try again.
            </p>
          ) : (
            <Image
              src={draftMediaPath(draftId, id)}
              alt={photo.alt ?? "Draft cover photograph"}
              width={320}
              height={180}
              unoptimized
              onError={() => setFailedAsset(id)}
              className="h-auto w-full max-w-xs rounded"
            />
          )}
          <StudioField
            path="coverImage.alt"
            label="Photo description"
            value={photo.alt}
            onChange={(alt) => onChange({ ...photo, alt })}
            issues={fieldIssues}
          />
          <div>
            <Button
              variant="secondary"
              disabled={progress !== undefined}
              onClick={() => {
                setFailure("");
                onChange(undefined);
                setNotice(
                  "Photo removed from the cover. Save the draft to keep this change.",
                );
              }}
            >
              Remove cover photo
            </Button>
          </div>
        </div>
      )}
      {available ? (
        <div className="studio-field">
          <label htmlFor="studio-photo-file">
            {id ? "Replace cover photo" : "Choose cover photo"}
          </label>
          <input
            id="studio-photo-file"
            type="file"
            accept={IMAGE_TYPES.join(",")}
            aria-describedby={
              failure
                ? "studio-photo-help studio-photo-error"
                : "studio-photo-help"
            }
            aria-invalid={failure ? true : undefined}
            disabled={progress !== undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void select(file);
            }}
          />
        </div>
      ) : (
        <p className="text-sm">Photo uploads are currently unavailable.</p>
      )}
      {progress !== undefined && (
        <div className="grid gap-2">
          {progress === "verifying" ? (
            <p role="status">Verifying photo…</p>
          ) : (
            <progress
              aria-label="Cover photo upload progress"
              value={progress}
              max={100}
            />
          )}
          <div>
            <Button
              variant="secondary"
              onClick={() => running.current?.abort()}
            >
              Cancel upload
            </Button>
          </div>
        </div>
      )}
      {failure && (
        <p id="studio-photo-error" role="alert" className="studio-error">
          {failure}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </fieldset>
  );
}
