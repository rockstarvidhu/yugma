import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./client";

export function createServiceClient() {
  const config = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret?.startsWith("sb_secret_"))
    throw new Error("Supabase server access is unavailable");

  return createClient(config.url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
