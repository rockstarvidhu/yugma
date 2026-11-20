"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerAuth } from "@/lib/auth/server";
import { studioReturnPath } from "@/lib/auth/studio-path";

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
