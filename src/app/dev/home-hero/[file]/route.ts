import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  desktopHeroSources,
  mobileHeroSources,
  storefrontPhotoReviewEnabled,
} from "@/lib/home-hero-assets";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, noimageindex",
};

export async function GET(
  _request: Request,
  { params }: RouteContext<"/dev/home-hero/[file]">,
) {
  const { file } = await params;
  const allowed = [...desktopHeroSources, ...mobileHeroSources].some(
    ([name]) => name === file,
  );
  if (storefrontPhotoReviewEnabled() && allowed) {
    try {
      const bytes = await readFile(
        join(process.cwd(), "assets", "storefront-hero-review", file),
      );
      return new Response(new Uint8Array(bytes), {
        headers: { ...privateHeaders, "Content-Type": "image/webp" },
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
  return new Response(null, { status: 404, headers: privateHeaders });
}
