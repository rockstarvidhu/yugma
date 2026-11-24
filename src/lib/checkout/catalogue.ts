import "server-only";
import { getServerAuth } from "@/lib/auth/server";
import { canCreatePrivateDraft } from "@/lib/auth/service";
import { getRazorpayTestConfig } from "./gateway";
export async function readTestPrices() {
  if (!canCreatePrivateDraft() || !getRazorpayTestConfig()) return {};
  const client = await getServerAuth();
  if (!client) return {};
  const { data } = await client
    .from("templates")
    .select("registry_key,price_in_paise")
    .eq("status", "active")
    .eq("draft_eligible", true)
    .eq("currency", "INR")
    .gte("price_in_paise", 100);
  return Object.fromEntries(
    (data ?? []).map((row) => [row.registry_key, Number(row.price_in_paise)]),
  );
}
