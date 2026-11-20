import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { desktopHeroSources, mobileHeroSources } from "@/lib/home-hero-assets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  if (process.env.NODE_ENV !== "development")
    return new Response(null, { status: 404 });

  const { file } = await params;
  const sources = [...desktopHeroSources, ...mobileHeroSources];
  if (!sources.some(([name]) => name === file))
    return new Response(null, { status: 404 });

  const image = await readFile(
    join(process.cwd(), "assets", "home-hero", file),
  );
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" },
  });
}
