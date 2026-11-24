import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
// Keep the PR #23 review entry point and its renderer artwork export.
if (!process.argv.includes("--capture-afterglow")) {
  if (!process.argv.includes("--photo")) process.argv.push("--fallback");
  await import("./verify-reference-storefront.mjs");
} else {
  const playwright = await import(
    process.env.PLAYWRIGHT_MODULE
      ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE, "index.mjs")).href
      : "playwright"
  );
  const browserEngine = process.argv.includes("--webkit")
    ? "webkit"
    : "chromium";
  const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:3174";
  const browser = await playwright[browserEngine].launch(
    browserEngine === "chromium" && process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {},
  );
  async function waitForArt(page, selector) {
    await page.waitForFunction((selector) => {
      const image = document.querySelector(selector);
      return image?.complete && image.naturalWidth > 0;
    }, selector);
  }

  async function frameAfterglowArtwork() {
    for (const [width, height, label] of [
      [430, 615, "portrait"],
      [768, 768, "wide"],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        reducedMotion: "reduce",
      });
      assert.equal((await page.goto(base + "/demo/afterglow")).status(), 200);
      await page.getByRole("heading", { name: "Tara & Neel" }).waitFor();
      await page.getByRole("complementary", { name: "Demo preview" }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".heirloom-cover__image").waitFor();
      await waitForArt(page, ".heirloom-cover__image");
      // Set framing only for the capture. The registered renderer supplies the cover and demo mark.
      await page.addStyleTag({
        content:
          ".afterglow-invitation{padding-inline:0}.heirloom-cover{height:100vh;min-height:100vh}.yugma-demo-badge{top:auto;bottom:14px;right:14px;transform:none;writing-mode:horizontal-tb;padding:0.48rem 0.62rem;border-radius:0;color:#f6f2ea}",
      });
      const cover = page.locator(".heirloom-cover");
      await cover.evaluate((node) =>
        node.scrollIntoView({ block: "start", behavior: "instant" }),
      );
      const box = await cover.boundingBox();
      assert(
        box &&
          Math.abs(box.y) <= 1 &&
          box.x === 0 &&
          box.width === width &&
          box.height === height,
      );
      assert(await page.locator(".yugma-demo-badge").isVisible());
      const frame = await page.screenshot({ scale: "css" });
      await sharp(frame)
        .webp({ quality: 87 })
        .toFile(
          "public/images/storefront/afterglow-editorial-" + label + ".webp",
        );
      await page.close();
    }
  }

  try {
    await frameAfterglowArtwork();
  } finally {
    await browser.close();
  }
}
