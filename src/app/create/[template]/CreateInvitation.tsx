"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { createStudioDraft } from "@/lib/studio/draft-client";

export function CreateInvitation({ templateKey }: { templateKey: string }) {
  const router = useRouter();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<number>();
  const signIn = `/sign-in?next=${encodeURIComponent(`/create/${templateKey}`)}`;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError(undefined);
    const result = await createStudioDraft(templateKey);
    if ("draft" in result && result.draft.templateKey === templateKey) {
      router.replace(`/studio/${result.draft.id}`);
      return;
    }
    setError("status" in result ? result.status : 0);
    setPending(false);
    locked.current = false;
  }

  return (
    <form className="studio-panel" onSubmit={create}>
      <p>
        Start with an empty private draft. You can add details and preview the
        design in Studio.
      </p>
      {error !== undefined && (
        <p className="studio-error" role="alert">
          {error === 401 ? (
            <>
              Your session has ended.{" "}
              <Link href={signIn} className="studio-link">
                Sign in again
              </Link>{" "}
              to create a draft.
            </>
          ) : error === 422 ? (
            "This design is currently unavailable for private drafts."
          ) : (
            <>
              We couldn’t confirm creation.{" "}
              <Link href="/studio" className="studio-link">
                Check your drafts
              </Link>{" "}
              before trying again.
            </>
          )}
        </p>
      )}
      <div>
        <Button
          type="submit"
          disabled={pending || error === 401 || error === 422}
        >
          {pending ? "Creating draft…" : "Create private draft"}
        </Button>
      </div>
    </form>
  );
}
