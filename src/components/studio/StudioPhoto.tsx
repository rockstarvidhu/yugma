"use client";

import { useEffect, useRef, useState } from "react";
import { CoverPhoto } from "@/components/invitation/CoverPhoto";
import { Button } from "@/components/ui/Button";
import { resolveCoverPhoto, type CoverPhotoSource } from "@/lib/cover-photo";
import {
  draftMediaPath,
  IMAGE_TYPES,
  privatePhotoId,
  privatePhotoReference,
} from "@/lib/media/contract";
import { preparePhotoPreview } from "@/lib/media/prepare-photo";
import {
  PhotoVerificationError,
  uploadPrivatePhoto,
} from "@/lib/media/upload-client";
import type { FocalPosition, InvitationDraft } from "@/lib/invitation-schema";
import { StudioField } from "./StudioField";

type Photo = NonNullable<InvitationDraft["coverImage"]>;
type Selection = { file: File; assetId?: string };
const center = { x: 0.5, y: 0.5 };
const defaultAlt = "Wedding cover photograph";

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
  const input = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  const running = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | "checking" | "verifying">();
  const [candidate, setCandidate] = useState<CoverPhotoSource>();
  const [retry, setRetry] = useState<Selection>();
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [failedSource, setFailedSource] = useState<string>();
  const uploading = progress !== undefined;
  const id = privatePhotoId(photo?.src);
  const current =
    id && photo
      ? {
          ...photo,
          src: draftMediaPath(draftId, id),
          alt: photo.alt.trim() || defaultAlt,
        }
      : resolveCoverPhoto(photo);
  const display = candidate ?? current;
  const unavailable = display && failedSource === display.src;
  const focal = photo?.focalPosition ?? center;
  const fieldIssues = {
    ...issues,
    "coverImage.alt": issues["coverImage.alt"] ?? issues["coverImage.src"],
  };

  useEffect(
    () => () => {
      const active = running.current;
      running.current = null;
      active?.abort();
    },
    [],
  );

  useEffect(() => {
    if (uploading || !restoreFocus.current) return;
    restoreFocus.current = false;
    input.current?.focus();
  }, [uploading]);

  async function select(selection: Selection) {
    if (disabled || !available || running.current) return;

    const controller = new AbortController();
    const { signal } = controller;
    const { file, assetId } = selection;
    running.current = controller;
    onBusy(true);
    setProgress("checking");
    setRetry(undefined);
    setFailure("");
    setNotice("");
    let source: string | undefined;
    try {
      source = await preparePhotoPreview(file, signal);
      signal.throwIfAborted();
      setCandidate({ src: source, alt: "Selected cover photograph" });
      setProgress(assetId ? "verifying" : 0);
      const verified = await uploadPrivatePhoto(
        draftId,
        file,
        signal,
        setProgress,
        assetId,
      );
      signal.throwIfAborted();
      onChange({
        src: privatePhotoReference(verified),
        alt: defaultAlt,
        focalPosition: center,
      });
      setNotice("Photo ready. Save the draft to keep it.");
    } catch (error) {
      if (running.current !== controller) return;
      if (signal.aborted) setNotice("Upload cancelled.");
      else {
        setFailure(
          error instanceof Error ? error.message : "Couldn’t upload the photo.",
        );
        if (source)
          setRetry({
            file,
            assetId:
              error instanceof PhotoVerificationError
                ? error.assetId
                : undefined,
          });
      }
    } finally {
      if (source) URL.revokeObjectURL(source);
      if (running.current === controller) {
        running.current = null;
        setCandidate(undefined);
        setProgress(undefined);
        onBusy(false);
      }
    }
  }

  function crop(focalPosition: FocalPosition) {
    if (photo) onChange({ ...photo, focalPosition });
  }

  return (
    <fieldset className="studio-events" disabled={disabled}>
      <legend>Cover photo (optional)</legend>
      <p id="studio-photo-help" className="text-sm">
        Use a JPEG, PNG, or WebP photo up to 5 MiB and 20 megapixels.
      </p>
      <div className="studio-grid">
        <div className="heirloom-cover studio-cover-window">
          {display && !unavailable && (
            <CoverPhoto
              key={display.src}
              photo={display}
              privateAsset={Boolean(id || candidate)}
              onUnavailable={() => setFailedSource(display.src)}
            />
          )}
          <div className="heirloom-cover__veil" aria-hidden="true" />
          {!display && <span>No cover photo</span>}
          {unavailable && <span>Cover preview unavailable</span>}
        </div>
        <div className="studio-events">
          {available ? (
            <div className="studio-field">
              <label htmlFor="studio-photo-file">
                {current ? "Replace cover photo" : "Choose cover photo"}
              </label>
              <input
                id="studio-photo-file"
                ref={input}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                aria-describedby={
                  failure
                    ? "studio-photo-help studio-photo-error"
                    : "studio-photo-help"
                }
                aria-invalid={failure ? true : undefined}
                disabled={uploading}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void select({ file });
                }}
              />
            </div>
          ) : (
            <p className="text-sm">Photo uploads are currently unavailable.</p>
          )}
          <p aria-live="polite" className="text-sm">
            {progress === "checking"
              ? "Checking photo…"
              : progress === "verifying"
                ? "Verifying photo…"
                : typeof progress === "number"
                  ? "Uploading photo…"
                  : notice}
          </p>
          {typeof progress === "number" && (
            <progress
              aria-label="Cover photo upload progress"
              value={progress}
              max={100}
            />
          )}
          {failure && (
            <p id="studio-photo-error" role="alert" className="studio-error">
              {failure}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {uploading && (
              <Button
                variant="secondary"
                onClick={() => {
                  restoreFocus.current = true;
                  running.current?.abort();
                }}
              >
                Cancel upload
              </Button>
            )}
            {retry && (
              <Button variant="secondary" onClick={() => void select(retry)}>
                {retry.assetId
                  ? "Retry photo verification"
                  : "Retry photo upload"}
              </Button>
            )}
            {unavailable && !uploading && (
              <Button
                variant="secondary"
                onClick={() => setFailedSource(undefined)}
              >
                Retry cover preview
              </Button>
            )}
            {current && (
              <Button
                variant="ghost"
                disabled={uploading}
                onClick={() => {
                  setFailure("");
                  setRetry(undefined);
                  setFailedSource(undefined);
                  onChange(undefined);
                  setNotice(
                    "Photo removed. Save the draft to keep this change.",
                  );
                  input.current?.focus();
                }}
              >
                Remove cover photo
              </Button>
            )}
          </div>
        </div>
      </div>
      {current && photo && (
        <>
          <StudioField
            path="coverImage.alt"
            label="Photo description"
            value={photo.alt}
            onChange={(alt) => onChange({ ...photo, alt })}
            issues={fieldIssues}
            disabled={uploading}
            hint="Describe what the photo shows for guests who use screen readers."
          />
          <div className="studio-grid">
            {(["x", "y"] as const).map((axis) => (
              <div className="studio-field" key={axis}>
                <label htmlFor={`studio-photo-${axis}`}>
                  {axis === "x"
                    ? "Horizontal crop position"
                    : "Vertical crop position"}
                </label>
                <input
                  id={`studio-photo-${axis}`}
                  type="range"
                  min={0}
                  max={100}
                  disabled={uploading}
                  value={Math.round(focal[axis] * 100)}
                  onChange={(event) =>
                    crop({
                      ...focal,
                      [axis]: event.currentTarget.valueAsNumber / 100,
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div>
            <Button
              variant="secondary"
              disabled={uploading}
              onClick={() => crop(center)}
            >
              Center photo
            </Button>
          </div>
        </>
      )}
    </fieldset>
  );
}
