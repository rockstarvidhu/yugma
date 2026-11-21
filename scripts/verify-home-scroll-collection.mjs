import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE, "index.mjs"))
        .href
    : "playwright"
);
const root = process.env.PREVIEW_URL || "http://127.0.0.1:3160";
const production = process.argv.includes("--production");
const output = path.resolve("artifacts/home-collection/final-review");
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const report = { root, production, viewports: [], demos: [] };
await fs.mkdir(output, { recursive: true });
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );

async function home(page, full = true) {
  const status = await page.goto(root);
  assert.equal(status.status(), 200);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
  if (full) await page.locator('[data-motion="full"]').waitFor();
  await settle(page);
}
async function seek(page, progress) {
  await page.evaluate((progress) => {
    const scene = document.querySelector(".home-moment");
    const stage = document.querySelector(".home-stage");
    window.scrollTo({
      top: (scene.offsetHeight - stage.offsetHeight) * progress,
      behavior: "instant",
    });
  }, progress);
  await settle(page);
}
async function shot(page, name, fullPage = false) {
  await page.screenshot({
    path: path.join(output, name),
    fullPage,
    animations: "disabled",
  });
}
async function measure(page) {
  return page.evaluate(() => {
    const element = (selector) => document.querySelector(selector);
    const stage = element(".home-stage");
    const heading = element("#collection-heading").getBoundingClientRect();
    const artwork = element(".home-featured-art").getBoundingClientRect();
    const copy = element(".home-moment-copy").getBoundingClientRect();
    const photo = element(".home-moment-photo");
    const picture = photo.getBoundingClientRect();
    const computed = getComputedStyle(photo);
    const [x, y] = computed.objectPosition.split(" ").map(parseFloat);
    const scale = Math.max(
      picture.width / photo.naturalWidth,
      picture.height / photo.naturalHeight,
    );
    const spareX = picture.width - photo.naturalWidth * scale;
    const spareY = picture.height - photo.naturalHeight * scale;
    const mapX = (px) => picture.left + (spareX * x) / 100 + px * scale;
    const mapY = (py) => picture.top + (spareY * y) / 100 + py * scale;
    const portrait = photo.naturalHeight > photo.naturalWidth;
    const [left, right, top, bottom] = portrait
      ? [0.27, 0.66, 0.6, 0.82]
      : [0.43, 0.61, 0.59, 0.85];
    const focus = {
      left: mapX(left * photo.naturalWidth),
      right: mapX(right * photo.naturalWidth),
      top: mapY(top * photo.naturalHeight),
      bottom: mapY(bottom * photo.naturalHeight),
    };
    const header = element(".home-header");
    return {
      progress: Number(
        element(".home-v2").style.getPropertyValue("--moment-progress"),
      ),
      width: innerWidth,
      height: innerHeight,
      headerHeight: header.offsetHeight,
      headerColor: getComputedStyle(header).color,
      headerBg: getComputedStyle(element(".home-header-row")).backgroundColor,
      sand: element(".home-v2").dataset.sand,
      whiteMark:
        getComputedStyle(element(".home-mark-light")).display !== "none",
      forestMark:
        getComputedStyle(element(".home-mark-dark")).display !== "none",
      photograph: Number(getComputedStyle(stage).opacity),
      zoom: Number(element(".home-v2").style.getPropertyValue("--moment-zoom")),
      title: Number(getComputedStyle(element(".home-moment-copy")).opacity),
      collectionTop: Math.round(
        element(".home-collection").getBoundingClientRect().top,
      ),
      headingTop: Math.round(heading.top),
      visibleArt: Math.round(
        Math.max(
          0,
          Math.min(innerHeight, artwork.bottom) -
            Math.max(header.offsetHeight, artwork.top),
        ),
      ),
      handFocusFits:
        focus.left >= 0 &&
        focus.right <= innerWidth &&
        focus.top > header.offsetHeight &&
        focus.bottom <= innerHeight,
      handFocusCenterY: Math.round((focus.top + focus.bottom) / 2),
      copyCoversHand: !(
        copy.right < focus.left ||
        copy.left > focus.right ||
        copy.bottom < focus.top ||
        copy.top > focus.bottom
      ),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}
async function scrollFilm(page, end, duration) {
  await page.evaluate(
    ({ end, duration }) =>
      new Promise((resolve) => {
        const from = window.scrollY;
        const started = performance.now();
        function next(now) {
          const progress = Math.min(1, (now - started) / duration);
          window.scrollTo(0, from + (end - from) * progress);
          if (progress < 1) requestAnimationFrame(next);
          else resolve();
        }
        requestAnimationFrame(next);
      }),
    { end, duration },
  );
}
async function record(width, height, filename, mobile) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    recordVideo: { dir: output, size: { width, height } },
  });
  const page = await context.newPage();
  try {
    await home(page);
    const finish = await page.evaluate(
      () =>
        document.querySelector("#templates").offsetTop -
        document.querySelector(".home-header").offsetHeight +
        48,
    );
    await page.waitForTimeout(700);
    await scrollFilm(page, finish, 4400);
    await page.waitForTimeout(550);
    if (mobile) {
      await scrollFilm(page, finish + height * 0.36, 950);
      await page.waitForTimeout(600);
    }
    await scrollFilm(page, 0, 4200);
    await page.waitForTimeout(650);
  } finally {
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(output, filename));
    await video.delete();
  }
}
async function checkDemos() {
  for (const slug of ["heirloom", "afterglow"]) {
    for (const width of [320, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      assert.equal((await page.goto(root + "/demo/" + slug)).status(), 200);
      const watermark = page.getByRole("complementary", {
        name: "Demo preview",
      });
      assert(await watermark.isVisible());
      await page.getByRole("button", { name: "Try Your Details" }).click();
      await page.getByLabel("Partner 1 name").fill("");
      await page.getByRole("button", { name: "Apply to Preview" }).click();
      assert.equal(
        await page.getByLabel("Partner 1 name").getAttribute("aria-invalid"),
        "true",
      );
      await page.getByLabel("Partner 1 name").fill("Fictional");
      await page.getByRole("button", { name: "Apply to Preview" }).click();
      assert(
        (await page.getByRole("heading", { level: 1 }).textContent()).includes(
          "Fictional",
        ),
      );
      assert(await watermark.isVisible());
      await page.getByRole("button", { name: "Reset to Sample" }).click();
      await page.reload();
      assert(
        (await page.getByRole("heading", { level: 1 }).textContent()).includes(
          "Tara",
        ),
      );
      assert(await watermark.isVisible());
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        0,
      );
      report.demos.push({ slug, width, passed: true });
      await page.close();
    }
  }
}
async function checkHomepage() {
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    const mobile = width < 768;
    const dpr = width === 390 || width === 430 ? 2 : 1;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    await page.addInitScript(() => {
      window.homePaint = { layoutShift: 0, lcpMs: null, lcpImage: null };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput)
            window.homePaint.layoutShift += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        const candidate = list.getEntries().at(-1);
        window.homePaint.lcpMs = Math.round(candidate.startTime);
        window.homePaint.lcpImage =
          candidate.element?.classList.contains("home-moment-photo");
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    const heroRequests = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/dev/home-hero/"))
        heroRequests.push(url.pathname);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await home(page);
    const image = await page
      .locator(".home-moment-photo")
      .evaluate(async (photo) => {
        await photo.decode();
        const entry = performance.getEntriesByName(photo.currentSrc).at(-1);
        return {
          path: new URL(photo.currentSrc).pathname,
          bytes: entry.encodedBodySize,
          transfer: entry.transferSize,
          landscape: photo.naturalWidth > photo.naturalHeight,
        };
      });
    assert.equal(image.landscape, width >= 900);
    assert.deepEqual(
      heroRequests,
      [image.path],
      "Only the selected photograph downloads",
    );
    assert(image.bytes > 0);
    const initialPaint = await page.evaluate(() => window.homePaint);
    assert(
      initialPaint.layoutShift < 0.03,
      "Initial content stays stable as the image loads",
    );
    const frames = [];
    for (const progress of [
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.65, 0.7, 0.8, 0.9, 1,
    ]) {
      await seek(page, progress);
      const frame = await measure(page);
      assert.equal(frame.overflow, 0);
      assert(frame.zoom <= 1.091);
      assert.equal(frame.whiteMark, frame.sand === "false");
      assert.equal(frame.forestMark, frame.sand === "true");
      assert.equal(
        frame.headerColor,
        frame.sand === "true" ? "rgb(46, 58, 47)" : "rgb(255, 255, 255)",
      );
      assert(
        frame.photograph > 0.55 || frame.visibleArt > 75,
        "No empty transition frame",
      );
      if (progress === 0 || progress === 0.4)
        assert(frame.handFocusFits, "Joined-hands crop remains intact");
      if (progress === 0) assert.equal(frame.title, 0);
      if (progress === 0.4)
        assert(
          frame.title > 0.95 && !frame.copyCoversHand,
          "Headline sits clear of the hand focus",
        );
      if (progress === 0.7)
        assert(
          frame.visibleArt > 25 &&
            frame.photograph > 0.75 &&
            frame.handFocusCenterY < frame.collectionTop,
          "First artwork enters while the photo is present",
        );
      frames.push(frame);
      if (width === 1440 && progress === 0)
        await shot(page, "01-desktop-hero-1440.png");
      if (width === 390 && progress === 0)
        await shot(page, "02-mobile-hero-390.png");
      if (width === 390 && progress === 0.4)
        await shot(page, "03-mobile-headline-reveal.png");
      if (width === 390 && progress === 0.7)
        await shot(page, "04-mobile-transition-midpoint.png");
    }
    await seek(page, 0.4);
    assert((await measure(page)).title > 0.95);
    await seek(page, 0);
    assert.equal((await measure(page)).zoom, 1);
    const skip = page.getByRole("link", { name: "Skip intro" });
    await skip.focus();
    await page.keyboard.press("Enter");
    await settle(page);
    assert.equal(await page.evaluate(() => location.hash), "#templates");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "templates",
    );
    const section = await page.locator("#templates").boundingBox();
    assert(
      Math.abs(
        section.y - (await page.locator(".home-header").boundingBox()).height,
      ) < 3,
    );
    assert.equal(
      await skip.count(),
      0,
      "Skip intro is no longer exposed at the collection",
    );
    const gallery = page.getByRole("region", { name: "The YUGMA Collection" });
    const action = gallery.getByRole("link", {
      name: "Preview Experience: Afterglow",
    });
    assert.equal(await gallery.getByRole("link").count(), 2);
    assert.equal(
      await gallery
        .getByRole("link", { name: "View catalogue" })
        .getAttribute("href"),
      "/templates",
    );
    const track = gallery.getByRole("list", { name: "Invitation templates" });
    assert.equal(await track.getByRole("listitem").count(), 5);
    const nextTemplate = gallery.getByRole("button", { name: "Next template" });
    await nextTemplate.click();
    await gallery.getByRole("heading", { name: "Jasmine Hour" }).waitFor();
    assert(await gallery.getByText("Coming soon", { exact: true }).isVisible());
    await gallery.getByRole("button", { name: "Previous template" }).click();
    assert.equal(
      await gallery.getByRole("heading", { name: "Afterglow" }).count(),
      1,
    );
    assert.equal(await action.getAttribute("href"), "/demo/afterglow");
    const art = gallery.locator(
      '[data-template-id="afterglow"] .home-featured-art',
    );
    await art.locator("img").evaluate((img) => img.decode());
    const portrait = await art.boundingBox();
    assert(portrait.height / portrait.width > 1.35);
    assert.equal(await track.locator('[data-position="0"]').count(), 1);
    if (width === 390 || width === 1440) {
      await shot(
        page,
        width === 390
          ? "05-mobile-featured-template.png"
          : "06-desktop-featured-template.png",
      );
      await action.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL("**/demo/afterglow");
      assert(
        await page
          .getByRole("complementary", { name: "Demo preview" })
          .isVisible(),
      );
      await home(page);
    }
    if (width < 900) {
      await seek(page, 0);
      const menu = page.getByRole("button", { name: "Menu", exact: false });
      await menu.click();
      assert.equal(await menu.getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Escape");
      assert.equal(await menu.getAttribute("aria-expanded"), "false");
      assert(
        await menu.evaluate((button) => button === document.activeElement),
      );
    }
    assert.deepEqual(errors, []);
    report.viewports.push({
      width,
      height,
      dpr,
      image,
      initialPaint,
      frames,
      passed: true,
    });
    await context.close();
    console.log(width + "px passed");
  }
  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await home(reduced, false);
  await reduced.locator('[data-motion="static"]').waitFor();
  assert.equal(
    await reduced
      .locator(".home-stage")
      .evaluate((e) => getComputedStyle(e).position),
    "relative",
  );
  assert.equal(
    await reduced
      .locator(".home-moment-copy")
      .evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
  await reduced.getByRole("link", { name: "Skip intro" }).click();
  await settle(reduced);
  assert.equal(
    await reduced.getByRole("link", { name: "Skip intro" }).count(),
    0,
  );
  assert(
    await reduced
      .getByRole("link", { name: "Preview Experience: Afterglow" })
      .isVisible(),
  );
  await reduced.close();
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 568 },
  });
  const still = await noJs.newPage();
  await still.goto(root);
  await still.locator(".home-moment-photo").evaluate((photo) => photo.decode());
  assert(await still.getByRole("heading", { level: 1 }).isVisible());
  assert(
    await still
      .getByRole("link", { name: "Explore Templates" })
      .first()
      .isVisible(),
  );
  assert.equal(
    await still
      .locator(".home-stage")
      .evaluate((e) => getComputedStyle(e).position),
    "relative",
  );
  await noJs.close();
  report.reducedMotionAndNoJs = true;

  const resizing = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await home(resizing);
  await seek(resizing, 0.4);
  const resizingPhoto = resizing.locator(".home-moment-photo");
  for (const [width, height, composition] of [
    [1024, 768, "desktop"],
    [390, 844, "mobile"],
  ]) {
    await resizing.setViewportSize({ width, height });
    await resizing.waitForFunction(
      (name) =>
        document
          .querySelector(".home-moment-photo")
          .currentSrc.includes(`hero-${name}-`),
      composition,
    );
    await resizingPhoto.evaluate((photo) => photo.decode());
    assert.equal(
      await resizingPhoto.evaluate(
        (photo) => getComputedStyle(photo).transitionDuration,
      ),
      "0s",
    );
    assert.equal(await resizing.locator(".home-moment-photo").count(), 1);
  }
  await resizing.close();
  report.responsiveResize = true;

  const delayed = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  let releasePhoto;
  const imageGate = new Promise((resolve) => {
    releasePhoto = resolve;
  });
  let requestedPhoto;
  const requestSeen = new Promise((resolve) => {
    requestedPhoto = resolve;
  });
  await delayed.route("**/dev/home-hero/*.webp", async (route) => {
    requestedPhoto();
    await imageGate;
    await route.continue();
  });
  await delayed.goto(root, { waitUntil: "domcontentloaded" });
  await requestSeen;
  const earlyCopy = delayed.locator(".home-moment-copy");
  assert.equal(
    await earlyCopy.evaluate((copy) => getComputedStyle(copy).visibility),
    "hidden",
  );
  releasePhoto();
  await delayed.locator('[data-motion="full"]').waitFor();
  assert.equal((await measure(delayed)).title, 0);
  await seek(delayed, 0.4);
  assert((await measure(delayed)).title > 0.95);
  await delayed.close();
  report.noDelayedImageFlash = true;

  for (const [width, height, screenshot] of [
    [1440, 900, "07-full-homepage-desktop.png"],
    [390, 844, "08-full-homepage-mobile.png"],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    await home(page, false);
    await page
      .locator(".home-moment-photo")
      .evaluate((image) => image.decode());
    const art = page.locator(
      '[data-template-id="afterglow"] .home-featured-art img',
    );
    await art.scrollIntoViewIfNeeded();
    await art.evaluate((image) => image.decode());
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await settle(page);
    await shot(page, screenshot, true);
    await page.close();
  }
  await record(390, 844, "hero-to-collection-mobile.webm", true);
  await record(1440, 900, "hero-to-collection-desktop.webm", false);
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [430, 932],
  ])
    await record(
      width,
      height,
      `hero-to-collection-mobile-${width}.webm`,
      true,
    );
}

async function checkProductionHomepage() {
  for (const [width, height] of [
    [320, 568],
    [1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const photoRequests = [];
    page.on("request", (request) => {
      if (/hero-(mobile|desktop)-/.test(request.url()))
        photoRequests.push(request.url());
    });
    await home(page, false);
    assert.equal(await page.locator(".home-moment-photo").count(), 0);
    assert(await page.getByRole("heading", { level: 1 }).isVisible());
    assert(
      (
        await page
          .locator(".home-stage")
          .evaluate((stage) => getComputedStyle(stage).backgroundImage)
      ).includes("brand-hero.svg"),
    );
    assert.deepEqual(photoRequests, []);
    await page.getByRole("link", { name: "Skip intro" }).click();
    await settle(page);
    assert.equal(
      await page.getByRole("link", { name: "Skip intro" }).count(),
      0,
    );
    assert(
      await page
        .getByRole("link", { name: "Preview Experience: Afterglow" })
        .isVisible(),
    );
    report.viewports.push({ width, height, brandFallback: true });
    if (width === 1440) {
      const assets = await fs.readdir("assets/home-hero");
      for (const filename of assets)
        for (const prefix of ["/images/home/hero/", "/dev/home-hero/"])
          assert.equal(
            (await page.request.get(root + prefix + filename)).status(),
            404,
          );
    }
    await page.close();
  }
}

try {
  if (production) {
    await checkProductionHomepage();
    await checkDemos();
  } else {
    await checkHomepage();
  }
  await fs.writeFile(
    path.join(
      output,
      production ? "production-results.json" : "browser-results.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
