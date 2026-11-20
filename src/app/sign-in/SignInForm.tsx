"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { signIn } from "./actions";

const inputClass =
  "w-full rounded-sm border border-current/30 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function SignInForm({ returnTo }: { returnTo: string }) {
  const [error, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={returnTo} />
      <label className="grid gap-1">
        Email address
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="username"
          required
        />
      </label>
      <label className="grid gap-1">
        Password
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
