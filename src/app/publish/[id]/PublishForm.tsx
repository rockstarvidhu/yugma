"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { publishPath, publishRequestSchema } from "@/lib/publish/contract";

export function PublishForm({
  id,
  title,
  slug,
  version,
}: {
  id: string;
  title: string;
  slug: string;
  version: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const input = publishRequestSchema.safeParse({
      title: form.get("title"),
      slug: form.get("slug"),
      confirmed: form.get("confirmed") === "on",
      expectedVersion: version,
    });
    if (!input.success) {
      setError(
        "Enter a title and a link using lowercase letters, numbers and single hyphens.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/publish/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      if (response.status === 401) {
        router.push(`/sign-in?next=${encodeURIComponent(publishPath(id))}`);
        return;
      }
      if (!response.ok) {
        const { error } = (await response.json()) as { error?: string };
        setError(error ?? "Couldn’t publish. Try again.");
        return;
      }
      router.refresh();
      return;
    } catch {
      setError("Couldn’t check whether publishing finished. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="studio-form" onSubmit={publish}>
      <label className="studio-field" htmlFor="publication-title">
        Invitation title
        <input
          id="publication-title"
          name="title"
          required
          maxLength={170}
          defaultValue={title}
        />
      </label>
      <label className="studio-field" htmlFor="publication-slug">
        Link ending
        <span className="flex items-center gap-2">
          <span aria-hidden="true">/i/</span>
          <input
            id="publication-slug"
            name="slug"
            required
            minLength={3}
            maxLength={80}
            spellCheck={false}
            autoCapitalize="none"
            defaultValue={slug}
            aria-describedby="slug-hint"
          />
        </span>
      </label>
      <p id="slug-hint" className="text-sm">
        Use lowercase letters, numbers and hyphens.
      </p>
      <label className="flex items-baseline gap-2">
        <input type="checkbox" name="confirmed" required />
        <span>
          I’ve reviewed the details. Anyone with the link can view this
          invitation and its cover photo.
        </span>
      </label>
      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Publishing…" : "Publish invitation"}
      </Button>
    </form>
  );
}
