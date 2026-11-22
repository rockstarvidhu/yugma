import { beginMedia } from "@/lib/media/http";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/drafts/[id]/media">,
) {
  return beginMedia(request, (await params).id);
}
