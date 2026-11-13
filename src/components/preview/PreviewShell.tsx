"use client";

import { useRef, useState } from "react";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import type { Invitation } from "@/types/invitation";
import { DemoWatermark } from "./DemoWatermark";
import { PreviewForm } from "./PreviewForm";
import "./preview-shell.css";

export function PreviewShell({
  sample,
  templateId,
  trustedImageOrigin,
}: {
  sample: Invitation;
  templateId: string;
  trustedImageOrigin?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [personalized, setPersonalized] = useState<Invitation>();
  const sampleButton = useRef<HTMLButtonElement>(null);

  function reset() {
    setPersonalized(undefined);
    setEditing(false);
    sampleButton.current?.focus();
  }

  return (
    <>
      <DemoWatermark mode={personalized ? "personalized" : "sample"} />
      <section
        className="preview-panel"
        aria-labelledby="preview-controls-heading"
      >
        <div className="preview-panel-inner">
          <h2 id="preview-controls-heading">Invitation preview</h2>
          <div className="preview-actions">
            <button
              type="button"
              ref={sampleButton}
              aria-pressed={!editing}
              onClick={reset}
            >
              View Sample
            </button>
            <button
              type="button"
              aria-expanded={editing}
              aria-controls={editing ? "preview-editor" : undefined}
              onClick={() => setEditing(true)}
            >
              Try Your Details
            </button>
            {editing && <a href="#invitation-preview">Jump to invitation</a>}
          </div>
          {editing && (
            <PreviewForm
              sample={sample}
              apply={setPersonalized}
              reset={reset}
            />
          )}
          <p role="status" className="preview-status">
            {personalized
              ? "Personalized invitation shown below."
              : editing
                ? "The sample stays visible until you apply your details."
                : ""}
          </p>
        </div>
      </section>
      <div id="invitation-preview" tabIndex={-1}>
        <InvitationRenderer
          templateId={templateId}
          invitation={personalized ?? sample}
          trustedImageOrigin={trustedImageOrigin}
        />
      </div>
    </>
  );
}
