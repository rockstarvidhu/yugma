"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerAuth } from "@/lib/auth/server";
import { studioReturnPath } from "@/lib/auth/studio-path";
import { stagingPublishingEnabled } from "@/lib/publish/store";

const credentialsSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
  password: z.string().min(1).max(1024),
});

export async function signIn(_error: string | null, formData: FormData) {
  const credentials = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!credentials.success) return "Enter your email address and password.";

  const client = await getServerAuth({ writeCookies: true });
  if (!client) return "Sign-in is currently unavailable.";

  const { error } = await client.auth.signInWithPassword(credentials.data);
  if (error)
    return "We couldn’t sign you in. Check your details and try again.";

  redirect(studioReturnPath(formData.get("next")));
}

type SignUpState = { message: string; confirmed?: boolean } | null;

export async function signUp(
  _state: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  if (!stagingPublishingEnabled())
    return { message: "Account creation is currently unavailable." };
  const credentials = credentialsSchema
    .extend({ password: z.string().min(8).max(1024) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!credentials.success)
    return {
      message:
        "Enter a valid email and a password with at least eight characters.",
    };
  const client = await getServerAuth({ writeCookies: true });
  if (!client) return { message: "Account creation is currently unavailable." };
  const next = studioReturnPath(formData.get("next"));
  const origin = process.env.SITE_URL && URL.parse(process.env.SITE_URL);
  const callback = origin && new URL("/auth/confirm", origin);
  if (callback) callback.searchParams.set("next", next);
  const { data, error } = await client.auth.signUp({
    ...credentials.data,
    options: { emailRedirectTo: callback ? callback.href : undefined },
  });
  if (error)
    return {
      message:
        "Couldn’t create the account. Check your details or try signing in.",
    };
  if (data.session) redirect(next);
  return {
    message:
      "Check your email for the confirmation link, then sign in to continue.",
    confirmed: true,
  };
}
