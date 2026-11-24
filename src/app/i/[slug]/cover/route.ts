import { openStorage } from "@/lib/media/storage";
import { loadTestPublication } from "@/lib/publish/store";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/i/[slug]/cover">,
) {
  const { slug } = await params;
  const headers = { "Cache-Control": "no-store" };
  try {
    const publication = await loadTestPublication(slug);
    if (
      !publication?.cover_draft_id ||
      !publication.cover_asset_id ||
      !publication.cover_size
    )
      return new Response(null, { status: 404, headers });
    const storage = openStorage();
    if (!storage) return new Response(null, { status: 503, headers });
    const image = await storage.final(
      publication.cover_draft_id,
      publication.cover_asset_id,
    );
    if (image.status === 404) {
      void image.body?.cancel().catch(() => undefined);
      return new Response(null, { status: 404, headers });
    }
    if (
      !image.ok ||
      image.headers.get("content-type") !== "image/webp" ||
      Number(image.headers.get("content-length")) !== publication.cover_size ||
      !image.body
    ) {
      void image.body?.cancel().catch(() => undefined);
      return new Response(null, { status: 502, headers });
    }
    return new Response(image.body, {
      headers: {
        ...headers,
        "Content-Type": "image/webp",
        "Content-Length": String(publication.cover_size),
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
