import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthClient, getSupabaseConfig } from "./client";
import { studioReturnPath } from "./studio-path";

export async function getServerAuth({ writeCookies = false } = {}) {
  // Keep guards request-time even when credentials are only set at runtime.
  const store = await cookies();
  const config = getSupabaseConfig();
  if (!config) return null;

  return createAuthClient(config, {
    getAll: () => store.getAll(),
    setAll: (updates) => {
      // The proxy handles refresh cookies before a Server Component renders.
      if (writeCookies)
        for (const { name, value, options } of updates)
          store.set(name, value, options);
    },
  });
}

export async function getStudioUser() {
  const client = await getServerAuth();
  if (!client) return null;

  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims;
  if (
    error ||
    !claims?.sub ||
    claims.role !== "authenticated" ||
    claims.is_anonymous === true
  )
    return null;

  return { id: claims.sub };
}

export async function requireStudioUser(returnTo: string) {
  const user = await getStudioUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(studioReturnPath(returnTo))}`);
  return user;
}
