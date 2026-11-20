"use server";

import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/server";

export async function signOut() {
  const client = await getServerAuth({ writeCookies: true });
  if (client) {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) redirect("/studio?error=sign-out");
  }
  redirect("/sign-in");
}
