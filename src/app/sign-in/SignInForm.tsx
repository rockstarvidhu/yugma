"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { signIn, signUp } from "./actions";

const inputClass =
  "w-full rounded-sm border border-current/30 bg-white p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function SignInForm({
  returnTo,
  creating = false,
}: {
  returnTo: string;
  creating?: boolean;
}) {
  const [error, signInAction, signingIn] = useActionState(signIn, null);
  const [registration, signUpAction, signingUp] = useActionState(signUp, null);
  const pending = creating ? signingUp : signingIn;
  const [email, setEmail] = useState("");

  return (
    <form
      action={creating ? signUpAction : signInAction}
      className="grid gap-4"
    >
      <input type="hidden" name="next" value={returnTo} />
      <label className="grid gap-1">
        Email address
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1">
        Password
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete={creating ? "new-password" : "current-password"}
          minLength={creating ? 8 : undefined}
          required
        />
      </label>
      {creating
        ? registration && (
            <p role={registration.confirmed ? "status" : "alert"}>
              {registration.message}
            </p>
          )
        : error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={pending}>
        {creating
          ? pending
            ? "Creating account…"
            : "Create account"
          : pending
            ? "Signing in…"
            : "Sign in"}
      </Button>
    </form>
  );
}
