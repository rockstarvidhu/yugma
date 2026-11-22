"use client";

import Link, { useLinkStatus } from "next/link";

function OpeningDraft() {
  const { pending } = useLinkStatus();
  return (
    <>
      <span aria-hidden="true">
        {pending ? "Opening draft…" : "Continue editing"}
      </span>
      <span className="sr-only" role="status">
        {pending ? "Opening your draft…" : ""}
      </span>
    </>
  );
}

export function StudioDraftLink({ id, title }: { id: string; title: string }) {
  return (
    <Link
      href={`/studio/${id}`}
      className="studio-link"
      aria-label={`Continue editing ${title}`}
      prefetch={false}
    >
      <OpeningDraft />
    </Link>
  );
}
