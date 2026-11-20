import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient, getSupabaseConfig } from "@/lib/auth/client";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (config) {
    const client = createAuthClient(config, {
      getAll: () => request.cookies.getAll(),
      setAll: (updates, headers) => {
        for (const { name, value } of updates) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of updates)
          response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers))
          response.headers.set(name, value);
      },
    });
    await client.auth.getClaims();
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/sign-in", "/studio/:path*"],
};
