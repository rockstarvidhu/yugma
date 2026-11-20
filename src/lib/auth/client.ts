import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_")) return null;

  const origin = URL.parse(url);
  if (!origin || origin.origin !== url.replace(/\/$/, "")) return null;
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.protocol !== "https:" && !(isLocal && origin.protocol === "http:"))
    return null;

  return { url: origin.origin, key };
}

export function createAuthClient(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  cookies: CookieMethodsServer,
) {
  return createServerClient(config.url, config.key, {
    cookies,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  });
}
