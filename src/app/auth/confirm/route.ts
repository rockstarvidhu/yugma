import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/server";
import { studioReturnPath } from "@/lib/auth/studio-path";
import { stagingPublishingEnabled } from "@/lib/publish/store";

export async function GET(request: Request) {
  if (!stagingPublishingEnabled()) return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const code = query.get("code");
  const next = studioReturnPath(query.get("next"));
  if (code && code.length <= 256) {
    const client = await getServerAuth({ writeCookies: true });
    const result = await client?.auth.exchangeCodeForSession(code);
    if (result && !result.error) redirect(next);
  }
  redirect(`/sign-in?next=${encodeURIComponent(next)}&confirmation=failed`);
}
