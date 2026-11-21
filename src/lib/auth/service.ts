import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./client";

function getServiceConfig() {
  const config = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  return config && secret?.startsWith("sb_secret_")
    ? { url: config.url, secret }
    : null;
}

export function canCreatePrivateDraft() {
  return getServiceConfig() !== null;
}

export function createServiceClient() {
  const config = getServiceConfig();
  if (!config) throw new Error("Supabase server access is unavailable");

  return createClient(config.url, config.secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
