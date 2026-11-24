import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const engines = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE, "index.mjs")).href
    : "playwright"
);
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const fallback = process.argv.includes("--fallback");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:3174";
const output = resolve(
  process.env.STOREFRONT_EVIDENCE_DIR ||
    "artifacts/storefront-editorial/private",
  fallback ? "fallback" : engine,
);
await mkdir(output, { recursive: true });
const browser = await engines[engine].launch(
  engine === "chromium" ? { executablePath: process.env.CHROME_PATH } : {},
);
const report = {
  engine,
  version: browser.version(),
  review: !fallback,
  viewports: [],
};
const nextFrame = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
const scroll = async (page, y) => {
  await page.evaluate((y) => scrollTo(0, y), y);
  await nextFrame(page);
};
async function travel(page, target) {
  await page.evaluate(
    (target) =>
      new Promise((done) => {
        const start = scrollY,
          distance = target - start,
          time = Math.max(160, Math.abs(distance) / 0.65);
        const at = performance.now();
        function tick(now) {
          const part = Math.min(1, (now - at) / time);
          scrollTo(0, start + part * distance);
          if (part < 1) requestAnimationFrame(tick);
          else done();
        }
        requestAnimationFrame(tick);
      }),
    target,
  );
}
async function select(page, index) {
  await page.waitForFunction(
    (i) =>
      document.querySelectorAll(".collection-slide")[i]?.dataset.selected ===
      "true",
    index,
  );
}
async function swipe(page) {
  const session = await page.context().newCDPSession(page);
  const box = await page.locator(".collection-rail").boundingBox();
  const x = box.x + box.width * 0.84,
    y = box.y + box.height * 0.5;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 12; i++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - i * box.width * 0.05, y }],
    });
    await page.waitForTimeout(20);
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
  await page.waitForFunction(
    () =>
      document.querySelector(".collection-slide").dataset.selected === "false",
  );
}
async function check(width, height) {
  const capture =
    !fallback && engine === "chromium" && [390, 1440].includes(width);
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 500,
    hasTouch: width < 500,
    deviceScaleFactor: 1,
    recordVideo: capture ? { dir: output, size: { width, height } } : undefined,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6500);
  const errors = [],
    bad = [],
    assets = new Set();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("response", (res) => {
    if (res.url().startsWith(base)) {
      if (res.status() >= 400) bad.push([res.status(), res.url()]);
      if (res.url().includes("/dev/home-hero/"))
        assets.add(new URL(res.url()).pathname);
    }
  });
  await page.addInitScript(() => {
    window.reviewShift = 0;
    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift"))
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.reviewShift += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
  });
  const snap = async (name) => {
    if (capture)
      await page.screenshot({
        path: join(output, width + "-" + name + ".png"),
      });
  };
  try {
    assert.equal(
      (await page.goto(base, { waitUntil: "domcontentloaded" })).status(),
      200,
    );
    if (capture) {
      await page.locator(".home-arrival:not([hidden])").waitFor();
      await page.waitForTimeout(220);
      await snap("01-arrival");
    }
    await page.waitForFunction(
      () => sessionStorage.getItem("yugma-arrival") === "seen",
    );
    await page.locator(".home-arrival").waitFor({ state: "hidden" });
    await page.evaluate(() => document.fonts.ready);
    await snap("02-hero");
    const cls = await page.evaluate(() => window.reviewShift);
    const metrics = await page.evaluate(() => {
      const img = document
        .querySelector(".home-hero-wordmark img")
        .getBoundingClientRect();
      return {
        pageWidth: document.documentElement.scrollWidth,
        width: innerWidth,
        logoRatio: img.width / img.height,
        heroSource:
          document.querySelector(".home-hero-art img")?.currentSrc || null,
      };
    });
    assert.equal(metrics.pageWidth, metrics.width);
    assert(Math.abs(metrics.logoRatio - 1832 / 436) < 0.02);
    assert(cls < 0.1, "CLS " + cls);
    if (fallback) {
      assert.equal(metrics.heroSource, null);
      assert.equal(await page.getByText("Heritage").count(), 0);
      assert.equal(
        (
          await context.request.get(base + "/dev/home-hero/hero-wide.webp")
        ).status(),
        404,
      );
    } else {
      assert(
        metrics.heroSource.endsWith(
          width >= height ? "hero-wide.webp" : "hero-portrait.webp",
        ),
      );
    }
    const sections = [
      "#statement",
      "#templates",
      "#design-afterglow",
      ".signature",
    ];
    for (const [i, selector] of sections.entries()) {
      const section = page.locator(selector);
      const y = await section.evaluate((node) =>
        Math.min(
          document.documentElement.scrollHeight - innerHeight,
          node.getBoundingClientRect().top + scrollY,
        ),
      );
      if (capture) await travel(page, y);
      else await scroll(page, y);
      await page.waitForTimeout(capture ? 620 : 80);
      await snap(["03-purpose", "04-collection", "05-detail", "footer"][i]);
      if (i === 1 && !fallback) {
        const rail = page.locator(".collection-rail"),
          next = page.getByRole("button", { name: "Next invitation" }),
          prev = page.getByRole("button", { name: "Previous invitation" });
        assert(await prev.isDisabled());
        await next.click();
        await select(page, 1);
        await rail.focus();
        await rail.press("End");
        await select(page, 2);
        assert(await next.isDisabled());
        await prev.click();
        await select(page, 1);
        await rail.press("Home");
        await select(page, 0);
        assert(await prev.isDisabled());
        if (width === 390 && engine === "chromium") {
          await swipe(page);
          await rail.press("Home");
          await select(page, 0);
        }
      }
    }
    const bottom = await page.evaluate(() => scrollY);
    const transform = () =>
      page
        .locator(".signature-track")
        .evaluate((el) => getComputedStyle(el).transform);
    const end = await transform();
    await scroll(page, bottom - 70);
    const reverse = await transform();
    assert.notEqual(end, reverse);
    await page.waitForTimeout(150);
    assert.equal(await transform(), reverse);
    await scroll(page, bottom);
    assert.equal(await transform(), end);
    if (capture) {
      await travel(page, 0);
      await page.waitForTimeout(420);
    }
    const video = page.video();
    if (video) {
      await page.close();
      await video.saveAs(join(output, width + "-forward-reverse.webm"));
      await video.delete();
    }
    const probe = video ? await context.newPage() : page;
    if (video) {
      await probe.goto(base);
      await probe.waitForFunction(
        () => sessionStorage.getItem("yugma-arrival") === "seen",
      );
    }
    await probe.goto(base);
    await probe.waitForFunction(
      () => document.querySelector(".signature-track")?.style.transform !== "",
    );
    assert(await probe.locator(".home-arrival").isHidden());
    if (width < 500) {
      await probe.locator(".home-menu summary").click();
      const menu = probe.getByRole("navigation", { name: "Mobile navigation" });
      await menu.getByRole("link", { name: "Templates" }).focus();
      await probe.keyboard.press("Escape");
      assert(
        await probe
          .locator("summary")
          .evaluate((el) => el === document.activeElement),
      );
    }
    await probe.emulateMedia({ reducedMotion: "reduce" });
    await probe.evaluate(() => sessionStorage.clear());
    await probe.reload();
    await probe.waitForFunction(
      () => sessionStorage.getItem("yugma-arrival") === "seen",
    );
    assert(await probe.locator(".home-arrival").isHidden());
    assert.equal(
      await probe
        .locator(".signature-track")
        .evaluate((el) => getComputedStyle(el).transform),
      "none",
    );
    if (width === 1440) {
      await probe.evaluate(() => {
        document.documentElement.style.zoom = "200%";
      });
      assert(
        await probe.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(bad, []);
    report.viewports.push({
      width,
      height,
      cls,
      ...metrics,
      artRequests: [...assets],
      errors,
      bad,
    });
    console.log("Passed", engine, width, height);
  } finally {
    await context.close();
  }
}
async function checkPublicRoutes() {
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    try {
      await page.goto(base + "/#templates");
      await page.waitForFunction(
        () =>
          Math.abs(
            document.querySelector("#templates").getBoundingClientRect().top,
          ) < 4,
      );
      const product = page.getByRole("link", { name: "Explore Afterglow" });
      await product.click();
      await page.getByRole("link", { name: /View Live Demo/ }).click();
      await page.getByRole("heading", { name: "Tara & Neel" }).waitFor();
      await page
        .locator(".heirloom-cover__image")
        .waitFor({ state: "visible" });
      await page.evaluate(() => document.fonts.ready);
      if (!fallback)
        await page.screenshot({ path: join(output, width + "-06-demo.png") });
      await page.getByRole("button", { name: "Try Your Details" }).click();
      await page.getByLabel("Partner 1 name").fill("Anika");
      await page
        .getByRole("heading", { name: "Anika & Neel" })
        .waitFor({ state: "attached" });
      if (!fallback) {
        await scroll(page, 0);
        await page.screenshot({
          path: join(output, width + "-07-personalize.png"),
        });
      }
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page
        .getByRole("link", { name: "Close demo and return to invitations" })
        .click();
      await page.waitForURL(base + "/#templates");
    } finally {
      await ctx.close();
    }
  }
  const noJS = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await noJS.newPage();
    await page.goto(base);
    assert(await page.locator(".home-arrival").isHidden());
    assert(
      await page
        .getByRole("heading", { name: "Cinematic digital wedding invitations" })
        .isVisible(),
    );
    assert(
      await page
        .getByRole("link", { name: "View Demo", exact: true })
        .isVisible(),
    );
  } finally {
    await noJS.close();
  }
  if (!fallback) {
    const broken = await browser.newPage();
    try {
      await broken.route("**/dev/home-hero/hero-*.webp", (route) =>
        route.abort(),
      );
      await broken.goto(base);
      await broken.locator(".home-arrival").waitFor({ state: "hidden" });
      assert(
        await broken
          .getByRole("link", { name: /Explore Invitations/ })
          .isVisible(),
      );
    } finally {
      await broken.close();
    }
  }
  report.routes = {
    sample: true,
    validEditsUpdateRenderer: true,
    deepLinks: true,
    withoutJavaScript: true,
  };
}
try {
  if (!process.argv.includes("--routes-only"))
    for (const [w, h] of fallback
      ? [[1440, 900]]
      : engine === "webkit"
        ? [
            [390, 844],
            [1440, 900],
          ]
        : [
            [1440, 900],
            [390, 844],
            [320, 568],
            [430, 932],
            [768, 1024],
            [1024, 768],
            [1920, 1080],
          ]) {
      await check(w, h);
    }
  await checkPublicRoutes();
  await writeFile(
    join(
      output,
      process.argv.includes("--routes-only")
        ? "route-checks.json"
        : "checks.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
