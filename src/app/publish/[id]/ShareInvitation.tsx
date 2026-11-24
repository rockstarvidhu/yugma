"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { invitationDescription, invitationPath } from "@/lib/publish/contract";

const subscribe = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => "";

export function ShareInvitation({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const path = invitationPath(slug);
  const origin = useSyncExternalStore(subscribe, browserOrigin, serverOrigin);
  const nativeShare = origin && typeof navigator.share === "function";
  const [status, setStatus] = useState("");
  const link = useRef<HTMLInputElement>(null);
  const url = origin ? new URL(path, origin).href : "";
  const text = invitationDescription(title);

  async function copy() {
    setStatus("");
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      link.current?.focus();
      link.current?.select();
      setStatus("Select and copy the link above.");
    }
  }

  async function share() {
    setStatus("");
    try {
      await navigator.share({ title, text, url });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setStatus("Use Copy link or open WhatsApp to share.");
    }
  }

  return (
    <section
      className="studio-panel grid gap-4"
      aria-labelledby="share-heading"
    >
      <h2 id="share-heading" className="font-editorial text-2xl">
        {title}
      </h2>
      <p>Anyone with this link can view the invitation.</p>
      <label className="studio-field">
        Invitation link
        <input ref={link} value={url || path} readOnly />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {nativeShare && (
          <Button onClick={() => void share()} disabled={!url}>
            Share invitation
          </Button>
        )}
        <Button variant="secondary" onClick={() => void copy()} disabled={!url}>
          Copy link
        </Button>
        {url && (
          <a
            className="studio-link"
            href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open WhatsApp
          </a>
        )}
        <a
          className="studio-link"
          href={path}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open public invitation
        </a>
      </div>
      <p role="status">{status}</p>
    </section>
  );
}
