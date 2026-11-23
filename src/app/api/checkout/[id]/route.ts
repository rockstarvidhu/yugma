import { getCheckoutStatus } from "@/lib/checkout/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/checkout/[id]">,
) {
  return getCheckoutStatus((await params).id);
}
