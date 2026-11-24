import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import manifest from "@/lib/storefront-art.json";
import { storefrontPhotoReviewEnabled } from "@/lib/home-hero-assets";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, noimageindex",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  _request: Request,
  { params }: RouteContext<"/dev/home-hero/[file]">,
) {
  const { file } = await params;
  if (
    storefrontPhotoReviewEnabled() &&
    manifest.some((entry) => basename(entry.path) === file)
  ) {
    try {
      const bytes = await readFile(
        join(process.cwd(), "assets", "storefront-hero-review", file),
      );
      return new Response(new Uint8Array(bytes), {
        headers: {
          ...headers,
          "Content-Type": file.endsWith(".svg")
            ? "image/svg+xml"
            : "image/webp",
        },
      });
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
  }
  return new Response(null, { status: 404, headers });
}
