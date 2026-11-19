// Optional local QA runner; Playwright stays outside the project dependency set.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(path.join(process.env.PLAYWRIGHT_MODULE, "index.mjs")).href
    : "playwright"
);
const base = process.env.PREVIEW_URL || "http://127.0.0.1:3151";
const output = path.resolve("artifacts/home-collection/day-1");
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const report = {
  environment: "Installed Google Chrome against production next start",
  base,
  viewports: [],
  demos: [],
  reducedMotion: false,
  noJavaScript: false,
};
fs.mkdirSync(output, { recursive: true });
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: "nextjs-portal { display:none!important }",
  });
}
async function shot(page, name, fullPage = false) {
  await page.screenshot({
    path: path.join(output, name),
    fullPage,
    animations: "disabled",
  });
}
try {
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1440, 1000],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 768,
      hasTouch: width < 900,
    });
    await context.addInitScript(() => {
      window.homeLayoutShift = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.homeLayoutShift += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    assert.equal((await page.goto(base)).status(), 200);
    await settle(page);
    assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
    assert.equal(await page.locator(".store-template").count(), 1);
    assert.equal(
      await page
        .locator('a[href*="checkout"],a[href*="/create/"],a[href="/templates"]')
        .count(),
      0,
    );
    const links = await page
      .locator("a[href]")
      .evaluateAll((items) => items.map((e) => e.getAttribute("href")));
    for (const href of links) {
      const url = new URL(href, locationFallback());
      assert(["/", "/demo/afterglow"].includes(url.pathname));
      if (url.hash) assert.equal(await page.locator(url.hash).count(), 1);
    }
    const hero = page.locator(".store-hero-photo img");
    await hero.evaluate((img) => img.decode());
    const crop = await hero.evaluate((img) => {
      const r = img.getBoundingClientRect(),
        scale = Math.max(r.width / 450, r.height / 450);
      const [x, y] = getComputedStyle(img)
        .objectPosition.split(" ")
        .map(Number.parseFloat);
      // Important joined-hands area in the approved 450x450 source crop.
      const left = ((r.width - 450 * scale) * x) / 100,
        top = ((r.height - 450 * scale) * y) / 100;
      return {
        sourceUrl: img.currentSrc,
        visible: img.complete && img.naturalWidth > 0,
        ratio: r.width / r.height,
        objectPosition: getComputedStyle(img).objectPosition,
        handsFit:
          left + 125 * scale >= -1 &&
          left + 345 * scale <= r.width + 1 &&
          top + 235 * scale >= -1 &&
          top + 375 * scale <= r.height + 1,
      };
    });
    assert(crop.visible && crop.handsFit);
    assert(crop.sourceUrl.includes("/_next/image"));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.equal(overflow, 0);
    await page.keyboard.press("Tab");
    assert(
      await page
        .getByRole("link", { name: "Skip to content" })
        .evaluate((e) => e === document.activeElement),
    );
    const focus = await page
      .getByRole("link", { name: "Skip to content" })
      .evaluate((e) => getComputedStyle(e).outlineStyle);
    assert.notEqual(focus, "none");
    await page.keyboard.press("Enter");
    assert(
      await page
        .locator("#main-content")
        .evaluate((e) => e === document.activeElement),
    );
    let menuTested = false;
    if (width < 900) {
      const toggle = page.getByRole("button", { name: "Menu", exact: true });
      await toggle.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      const nav = page.getByRole("navigation", { name: "Mobile navigation" });
      assert(
        await nav
          .getByRole("link", { name: "Home", exact: true })
          .evaluate((e) => e === document.activeElement),
      );
      await page.keyboard.press("Escape");
      assert(await toggle.evaluate((e) => e === document.activeElement));
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      await toggle.tap();
      if (width === 390) await shot(page, "04-header-mobile-menu.png");
      await nav.getByRole("link", { name: "Templates", exact: true }).tap();
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      menuTested = true;
    } else {
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Templates", exact: true })
        .click();
    }
    await page.waitForURL("**/#templates");
    assert.equal(new URL(page.url()).hash, "#templates");
    const anchor = await page.locator("#templates").boundingBox(),
      header = await page.locator(".store-header").boundingBox();
    assert(
      anchor.y >= header.height - 2,
      "collection anchor remains below sticky header",
    );
    await page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name: "How It Works", exact: true })
      .click();
    await page.waitForURL("**/#how-it-works");
    assert.equal(new URL(page.url()).hash, "#how-it-works");
    await page.goBack();
    await page.waitForURL("**/#templates");
    assert.equal(new URL(page.url()).hash, "#templates");
    await page.locator("#contact").scrollIntoViewIfNeeded();
    assert(await page.locator("#contact").isVisible());
    if (width === 390) await shot(page, "06-footer-mobile.png");
    const loaded = await page.locator("img").evaluateAll(async (items) => {
      await Promise.all(items.map((e) => e.decode().catch(() => {})));
      return items.every((e) => e.complete && e.naturalWidth > 0);
    });
    assert(loaded);
    if (width === 1440)
      await page.locator("#templates").screenshot({
        path: path.join(output, "05-template-section-scaffold.png"),
      });
    await page.goto(base);
    await settle(page);
    await hero.evaluate((img) => img.decode());
    if (width === 1440) await shot(page, "01-home-desktop-1440.png", true);
    if (width === 390) await shot(page, "02-home-mobile-390.png", true);
    if (width === 320) await shot(page, "03-home-mobile-320.png", true);
    const fonts = await page.locator("h1").evaluate((e) => ({
      heading: getComputedStyle(e).fontFamily,
      body: getComputedStyle(document.body).fontFamily,
    }));
    assert(fonts.heading.includes("Playfair"));
    assert(fonts.body.includes("Inter"));
    const cls = await page.evaluate(() => window.homeLayoutShift);
    assert.deepEqual(errors, []);
    report.viewports.push({
      width,
      height,
      overflow,
      menuTested,
      keyboardSkip: true,
      backNavigation: true,
      linksValid: true,
      allImagesLoaded: true,
      crop,
      fonts,
      layoutShift: cls,
      consoleErrors: errors,
    });
    await context.close();
    console.log(width + "px homepage passed");
  }
  for (const width of [320, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const name of ["heirloom", "afterglow"]) {
      assert.equal((await page.goto(base + "/demo/" + name)).status(), 200);
      const names = await page.getByRole("heading", { level: 1 }).textContent();
      const watermark = page.getByRole("complementary", {
        name: "Demo preview",
      });
      assert(await watermark.isVisible());
      assert.equal(await page.locator(".store-header").count(), 0);
      await page.getByRole("button", { name: "Try Your Details" }).click();
      await page.getByLabel("Partner 1 name").fill("");
      await page.getByRole("button", { name: "Apply to Preview" }).click();
      assert.equal(
        await page.getByLabel("Partner 1 name").getAttribute("aria-invalid"),
        "true",
      );
      assert(await watermark.isVisible());
      await page.getByLabel("Partner 1 name").fill("Fictional");
      await page.getByRole("button", { name: "Apply to Preview" }).click();
      assert(
        (await page.getByRole("heading", { level: 1 }).textContent()).includes(
          "Fictional",
        ),
      );
      await page.getByRole("button", { name: "Reset to Sample" }).click();
      assert.equal(
        await page.getByRole("heading", { level: 1 }).textContent(),
        names,
      );
      await page.reload();
      assert.equal(
        await page.getByRole("heading", { level: 1 }).textContent(),
        names,
      );
      assert(await watermark.isVisible());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        0,
      );
      report.demos.push({
        name,
        width,
        sample: true,
        invalidAndValidPreview: true,
        resetAndReload: true,
        watermark: true,
        overflow: 0,
      });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await reduced.goto(base);
  assert.equal(
    await reduced
      .locator(".store-link-button")
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
    "0s",
  );
  report.reducedMotion = true;
  await reduced.close();
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 568 },
  });
  const nojs = await context.newPage();
  await nojs.goto(base);
  assert(await nojs.getByRole("heading", { level: 1 }).isVisible());
  assert(
    await nojs
      .getByRole("navigation", { name: "Footer navigation" })
      .isVisible(),
  );
  report.noJavaScript = true;
  await context.close();
  fs.writeFileSync(
    path.join(output, "browser-results.json"),
    await format(JSON.stringify(report), { parser: "json" }),
  );
  console.log(
    "All homepage, accessibility and stable-demo production checks passed",
  );
} finally {
  await browser.close();
}
function locationFallback() {
  return "http://localhost/";
}
