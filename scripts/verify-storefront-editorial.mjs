import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const playwright = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE, "index.mjs")).href
    : "playwright"
);
const browserEngine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const photographic = process.argv.includes("--photo");
const evidence = process.argv.includes("--record");
const captureArt = process.argv.includes("--capture-afterglow");
const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:3167";
const output = resolve(
  process.env.STOREFRONT_EVIDENCE_DIR ??
    "artifacts/storefront-editorial/private",
);
const browser = await playwright[browserEngine].launch(
  browserEngine === "chromium" && process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {},
);
const states = [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1];
const widths =
  browserEngine === "webkit"
    ? [
        [390, 844],
        [1440, 900],
      ]
    : [
        [320, 568],
        [390, 844],
        [430, 932],
        [768, 1024],
        [1440, 900],
        [1920, 1080],
      ];
const report = {
  engine: browserEngine,
  version: browser.version(),
  photographic,
  viewports: [],
};
const assetsSelector = ".home-feature-art img";
const quote = "More than where and when.";

await mkdir(output, { recursive: true });
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
const screenshot = (page, name) =>
  page.screenshot({ path: join(output, name + ".png"), scale: "css" });
const opacity = (page) =>
  page
    .locator("[data-home-word]")
    .evaluateAll((nodes) =>
      nodes.map((node) => Number(getComputedStyle(node).opacity)),
    );

async function scrollTo(page, position) {
  await page.evaluate((y) => window.scrollTo(0, y), position);
  await settle(page);
}

async function anchorClear(page, target) {
  await page.waitForFunction((id) => {
    const top = document.querySelector(id).getBoundingClientRect().top;
    return top >= 66 && top <= 75;
  }, target);
}

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

async function layout(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return Array.from(["left", "top", "width", "height"], (key) =>
        Math.round(bounds[key]),
      );
    };
    const scene = document.querySelector(".home-statement");
    const stage = document.querySelector(".home-statement-stage");
    return {
      viewport: [innerWidth, innerHeight],
      scroll: scrollY,
      scrollWidth: document.documentElement.scrollWidth,
      textBox: rect("#statement-heading"),
      cta: rect(".home-hero-copy .home-actions"),
      wordmark: rect(".home-hero-wordmark"),
      hero: rect("#home"),
      stage: getComputedStyle(stage).position,
      stickyTravel: scene.offsetHeight - stage.offsetHeight,
      sceneStart: Math.round(scene.getBoundingClientRect().top + scrollY),
      productStart: Math.round(
        document.querySelector("#templates").getBoundingClientRect().top +
          scrollY,
      ),
      tone: document.querySelector(".home-editorial").dataset.headerTone,
      colors: [
        getComputedStyle(scene).backgroundColor,
        getComputedStyle(stage).color,
      ],
      font: getComputedStyle(stage).fontFamily,
      fontLoaded: [...document.fonts].some(
        (font) =>
          font.family.includes("Inter Tight") && font.status === "loaded",
      ),
    };
  });
}

function differentWords(values) {
  return values.every(
    (value, index) => index === 0 || value <= values[index - 1] + 0.001,
  );
}

async function verifyViewport(width, height) {
  const mobile = width <= 430;
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: width < 820,
    deviceScaleFactor: mobile ? 2 : 1,
  });
  const page = await context.newPage();
  const sampleFrames = [390, 1440].includes(width);
  const errors = [];
  const failures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === base)
      failures.push({
        url: new URL(response.url()).pathname,
        status: response.status(),
      });
  });

  await page.addInitScript(() => {
    window.homeVitals = { lcp: null, cls: 0 };
    if (typeof PerformanceObserver !== "function") return;
    for (const type of ["largest-contentful-paint", "layout-shift"]) {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) continue;
      new PerformanceObserver((entries) => {
        for (const item of entries.getEntries()) {
          if (type === "largest-contentful-paint")
            window.homeVitals.lcp = Math.round(item.startTime);
          else if (!item.hadRecentInput) window.homeVitals.cls += item.value;
        }
      }).observe({ type, buffered: true });
    }
  });
  assert.equal((await page.goto(base)).status(), 200);
  await page.waitForFunction(
    () => document.querySelector(".home-editorial").dataset.motion === "scroll",
  );
  await page.evaluate(() => document.fonts.ready);

  if (photographic) await waitForArt(page, ".home-hero-art img");
  const top = await layout(page);
  const earlyResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((item) => item.name.includes("/dev/home-hero/"))
      .map((item) => ({
        path: new URL(item.name).pathname,
        bytes: item.encodedBodySize,
      })),
  );
  assert.equal(earlyResources.length, photographic ? 1 : 0);
  if (photographic) {
    assert(
      earlyResources[0].path.includes(
        width < 820 ? "hero-mobile" : "hero-desktop",
      ),
    );
    const asset = await page.request.get(base + earlyResources[0].path);
    assert.equal(asset.status(), 200);
    earlyResources[0].fileBytes = (await asset.body()).byteLength;
    assert(earlyResources[0].fileBytes <= 199034);
  }
  assert.equal(top.scrollWidth, top.viewport[0]);
  assert.equal(top.tone, "dark");
  assert(top.cta[3] >= 44 && top.cta[1] + top.cta[3] <= height);
  assert(top.wordmark[2] >= width * 0.77);
  assert.equal(
    await page.locator(".home-header img[src*='wordmark']").count(),
    0,
  );
  assert.match(top.font, /Inter Tight/);
  if (browserEngine === "chromium") assert(top.fontLoaded);
  assert.equal(await page.getByRole("heading", { name: quote }).count(), 1);
  assert.equal(await page.locator(".home-test-price").count(), 0);
  assert.equal(
    await page.getByRole("link", { name: /buy|pay|publish/i }).count(),
    0,
  );
  assert.equal(
    await page.locator(".home-feature-art img").getAttribute("loading"),
    "lazy",
  );
  if (sampleFrames) await screenshot(page, "hero-" + width);
  await page.waitForTimeout(300);
  const vitals = await page.evaluate(() => ({ ...window.homeVitals }));

  assert.equal(top.stage, "sticky");
  assert(top.stickyTravel >= height * 0.8 && top.stickyTravel <= height);
  if (sampleFrames) {
    await scrollTo(page, top.sceneStart - height * 0.31);
    await screenshot(page, "boundary-" + width);
  }

  const samples = [];
  let referenceBox;
  for (const progress of states) {
    await scrollTo(
      page,
      top.sceneStart + Math.round(top.stickyTravel * progress),
    );
    const values = await opacity(page);
    assert(
      await page.locator("[data-home-word]").evaluateAll((words) =>
        words.every((word) => {
          const style = getComputedStyle(word);
          return (
            style.transform === "none" &&
            style.translate === "none" &&
            style.scale === "none" &&
            style.filter === "none"
          );
        }),
      ),
    );
    const position = await layout(page);
    assert.deepEqual(position.colors, [
      "rgb(246, 242, 234)",
      "rgb(38, 48, 39)",
    ]);
    assert.equal(position.tone, "light");
    assert(
      differentWords(values),
      "Words must always reveal in sentence order.",
    );
    assert(
      !samples.length ||
        values.every(
          (value, index) => value >= samples.at(-1).opacity[index] - 0.002,
        ),
    );
    referenceBox ??= position.textBox;
    assert(
      position.textBox.every(
        (value, index) => Math.abs(value - referenceBox[index]) <= 1,
      ),
      "Fixed statement geometry",
    );
    if (sampleFrames && [0, 0.25, 0.5, 0.75, 1].includes(progress))
      await screenshot(
        page,
        "statement-" + width + "-" + Math.round(progress * 100),
      );
    samples.push({
      progress,
      opacity: values.map((value) => Math.round(value * 1000) / 1000),
    });
  }
  assert.deepEqual(samples[0].opacity, [0, 0, 0, 0, 0]);
  assert.deepEqual(samples.at(-1).opacity, [1, 1, 1, 1, 1]);
  await scrollTo(page, top.sceneStart + Math.round(top.stickyTravel * 0.5));
  assert.deepEqual(
    (await opacity(page)).map((value) => Math.round(value * 1000) / 1000),
    samples.find((s) => s.progress === 0.5).opacity,
  );
  await scrollTo(page, 0);
  assert.equal((await layout(page)).tone, "dark");

  await page.keyboard.press(browserEngine === "webkit" ? "Alt+Tab" : "Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  assert(
    await skip.evaluate(
      (node) =>
        document.activeElement === node && node.matches(":focus-visible"),
    ),
  );
  if (width === 390) {
    const menu = page.locator(".home-menu summary");
    await menu.focus();
    await page.keyboard.press("Enter");
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await nav.waitFor();
    await page.keyboard.press(browserEngine === "webkit" ? "Alt+Tab" : "Tab");
    const first = nav.getByRole("link", { name: "Invitations" });
    assert(await first.evaluate((node) => node === document.activeElement));
    if (sampleFrames) await screenshot(page, "menu-keyboard-" + width);
    await page.keyboard.press("Escape");
    assert(
      await menu.evaluate(
        (node) => node === document.activeElement && !node.parentElement.open,
      ),
    );
    await menu.tap();
    await first.tap();
    await page.waitForURL(base + "/#templates");
    await anchorClear(page, "#templates");
    assert(await menu.evaluate((node) => !node.parentElement.open));
    await page.goBack();
    await page.waitForURL(base + "/");
    if (browserEngine === "chromium") {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.synthesizeScrollGesture", {
        x: 190,
        y: 650,
        yDistance: -340,
        speed: 450,
        gestureSourceType: "touch",
      });
      assert((await layout(page)).scroll > 100);
    }
  }
  await scrollTo(page, 0);
  await page
    .locator(".home-hero")
    .getByRole("link", { name: "Explore Invitations" })
    .click();
  await page.waitForURL(base + "/#templates");
  await anchorClear(page, "#templates");
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector(".home-editorial").dataset.motion === "scroll",
  );
  await anchorClear(page, "#templates");
  await waitForArt(page, assetsSelector);
  if (sampleFrames) {
    await page.locator("#templates").evaluate((node) => node.blur());
    await screenshot(page, "afterglow-" + width);
  }
  if (width === 390) {
    await page.locator(assetsSelector).scrollIntoViewIfNeeded();
    await screenshot(page, "afterglow-cover-" + width);
  }
  await page.locator(".home-final").scrollIntoViewIfNeeded();
  const extent = await layout(page);
  assert.equal(extent.scrollWidth, extent.viewport[0]);
  await scrollTo(page, 99999);
  if (sampleFrames) await screenshot(page, "closing-" + width);
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  report.viewports.push({
    width,
    height,
    visual: {
      source: earlyResources[0] ?? null,
      wordmark: top.wordmark,
      heroActions: top.cta,
    },
    layout: {
      allContentFits: true,
      statementSize: referenceBox,
      stickyTravel: top.stickyTravel,
    },
    vitals,
    samples,
    keyboardFocus: true,
    noUnexpectedErrors: true,
  });
  await context.close();
}

async function fallback(width, height, javaScriptEnabled) {
  const context = await browser.newContext({
    viewport: { width, height },
    javaScriptEnabled,
    reducedMotion: javaScriptEnabled ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  assert.equal((await page.goto(base)).status(), 200);
  const mode = javaScriptEnabled ? "reduced-motion" : "no-js";
  if (javaScriptEnabled)
    await page.waitForFunction(
      () =>
        document.querySelector(".home-editorial").dataset.motion === "static",
    );
  assert.deepEqual(await opacity(page), [1, 1, 1, 1, 1]);
  assert.equal((await layout(page)).stage, "static");
  const menu = page.locator(".home-menu summary");
  if (width < 660) {
    await menu.focus();
    await page.keyboard.press("Space");
    assert(
      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .isVisible(),
    );
    await menu.click();
  }
  await page.getByRole("link", { name: "Scroll to the statement" }).click();
  await anchorClear(page, "#statement");
  assert(await page.getByRole("heading", { name: quote }).isVisible());
  if (width === 390 || width === 1440)
    await screenshot(page, mode + "-" + width);
  await page.getByRole("link", { name: "Personalize" }).click();
  await page.waitForURL(base + "/demo/afterglow?personalize=1#preview-editor");
  await page.getByRole("complementary", { name: "Demo preview" }).waitFor();
  assert.equal(await page.locator("#preview-editor").count(), 1);
  await context.close();
}

async function validateDestinations() {
  const page = await browser.newPage();
  assert.equal((await page.goto(base + "/#templates")).status(), 200);
  await page.getByRole("link", { name: "View Live Demo" }).click();
  await page.getByRole("heading", { name: "Tara & Neel" }).waitFor();
  await page.getByRole("complementary", { name: "Demo preview" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/demo/afterglow");
  await screenshot(page, "live-demo");
  await page.getByRole("button", { name: "Try Your Details" }).click();
  assert(await page.locator("#preview-editor").isVisible());
  assert.equal((await page.goto(base + "/demo/heirloom")).status(), 200);
  await page.getByRole("heading", { name: "Tara & Neel" }).waitFor();
  await page.getByRole("complementary", { name: "Demo preview" }).waitFor();
  assert.equal((await page.goto(base + "/templates")).status(), 200);
  assert.equal(await page.getByRole("article").count(), 1);
  assert(await page.getByText("in Test Mode").isVisible());
  // Preserve sign-in and authenticated-only draft/media APIs without contacting hosted services.
  await page.goto(base + "/studio");
  await page.waitForURL(base + "/sign-in?next=*");
  assert.equal(new URL(page.url()).searchParams.get("next"), "/studio");
  assert.equal((await page.request.get(base + "/api/drafts")).status(), 401);
  const id = "a1000000-0000-4000-8000-000000000001";
  assert.equal(
    (
      await page.request.get(base + "/api/drafts/" + id + "/media/" + id)
    ).status(),
    401,
  );
  const asset = await page.request.get(
    base + "/dev/home-hero/hero-mobile-480.webp",
  );
  assert.equal(asset.status(), photographic ? 200 : 404);
  assert.match(asset.headers()["cache-control"], /no-store/);
  assert.equal(
    (await page.request.get(base + "/dev/home-hero/unknown.webp")).status(),
    404,
  );
  await page.close();
}

async function zoom() {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto(base);
  await page.evaluate(() => (document.documentElement.style.zoom = "200%"));
  const size = await layout(page);
  assert.equal(size.scrollWidth, size.viewport[0]);
  const cta = page
    .locator("#home")
    .getByRole("link", { name: "Explore Invitations" });
  await cta.click();
  await page.waitForURL(base + "/#templates");
  assert(await page.getByRole("link", { name: "Personalize" }).isVisible());
  await screenshot(page, "zoom-200");
  await page.close();
}

async function record(width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 600,
    hasTouch: width < 600,
    recordVideo: { dir: output, size: { width, height } },
  });
  const page = await ctx.newPage();
  const video = page.video();
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  if (photographic) await waitForArt(page, ".home-hero-art img");
  const { sceneStart, stickyTravel, productStart } = await layout(page);
  assert(stickyTravel > 0);
  async function glide(to, duration) {
    await page.evaluate(
      ({ to, duration }) =>
        new Promise((done) => {
          const start = scrollY;
          const epoch = performance.now();
          function draw(now) {
            const progress = Math.min((now - epoch) / duration, 1);
            const smooth = progress * progress * (3 - 2 * progress);
            window.scrollTo(0, start + (to - start) * smooth);
            if (progress < 1) requestAnimationFrame(draw);
            else done();
          }
          requestAnimationFrame(draw);
        }),
      { to, duration },
    );
  }
  await page.waitForTimeout(2300);
  await glide(sceneStart + stickyTravel * 0.91, 5500);
  await page.waitForTimeout(1800);
  await glide(productStart + (width < 600 ? 260 : 25), 3000);
  await waitForArt(page, assetsSelector);
  await page.waitForTimeout(2800);
  await glide(sceneStart + stickyTravel * 0.32, 3500);
  await page.waitForTimeout(1050);
  await glide(0, 3000);
  await page.waitForTimeout(1400);
  await ctx.close();
  const raw = await video.path();
  await video.saveAs(join(output, "storefront-scroll-" + width + ".webm"));
  await import("node:fs/promises").then(({ unlink }) => unlink(raw));
}

try {
  if (captureArt) {
    await frameAfterglowArtwork();
  } else {
    for (const [width, height] of widths) await verifyViewport(width, height);
    await fallback(390, 844, true);
    await fallback(390, 844, false);
    if (browserEngine === "chromium") {
      await fallback(1440, 900, true);
      await fallback(1440, 900, false);
      await validateDestinations();
      await zoom();
    }
    if (evidence) {
      await record(390, 844);
      await record(1440, 900);
    }
    report.checked = {
      reducedMotion: true,
      withoutJavaScript: true,
      normalAndReverse: true,
      directAnchorAndReload: true,
      demoRoutesAndPrice: browserEngine === "chromium",
      desktopCssZoom200: browserEngine === "chromium",
      keyboardAndTouch: true,
    };
    await writeFile(
      join(output, "results-" + browserEngine + ".json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        engine: report.engine,
        photographic,
        viewports: report.viewports.map(
          ({ width, height, vitals, visual }) => ({
            width,
            height,
            vitals,
            hero: visual.source,
          }),
        ),
        checked: report.checked,
      }),
    );
  }
} finally {
  await browser.close();
}
