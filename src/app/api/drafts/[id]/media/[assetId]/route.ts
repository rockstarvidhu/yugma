import { completeMedia, getMedia } from "@/lib/media/http";

type MediaContext = RouteContext<"/api/drafts/[id]/media/[assetId]">;

export async function POST(request: Request, { params }: MediaContext) {
  const { id, assetId } = await params;
  return completeMedia(request, id, assetId);
}

export async function GET(_request: Request, { params }: MediaContext) {
  const { id, assetId } = await params;
  return getMedia(id, assetId);
}
