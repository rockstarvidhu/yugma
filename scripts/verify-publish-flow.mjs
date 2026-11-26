import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const project = fileURLToPath(new URL("../", import.meta.url));
const evidence = resolve(
  project,
  process.env.PUBLISH_EVIDENCE_DIR ?? "artifacts/day-06",
);
const moduleUrl = (path, entry) => pathToFileURL(resolve(path, entry)).href;
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? moduleUrl(process.env.PLAYWRIGHT_MODULE, "index.mjs")
    : "playwright"
);
const { PGlite } = await import(
  process.env.PGLITE_MODULE
    ? moduleUrl(process.env.PGLITE_MODULE, "dist/index.js")
    : "@electric-sql/pglite"
);
const db = new PGlite();
const checks = [];
const pass = (description) => {
  checks.push(description);
  console.log("PASS " + description);
};
const serviceKey = "sb_secret_local-publish-check";
const publishableKey = "sb_publishable_local-publish-check";
const webhookSecret = randomUUID();
const users = new Map();
const objects = new Map();
const providerOrders = new Map();
const providerPayments = new Map();
const checkoutSecret = "fixture-checkout-secret";
let failProviderReads = false;
let base;
let app;
let browser;

const rpc = {
  create_private_draft: ["p_owner_id", "p_registry_key", "p_data"],
  save_private_draft: [
    "p_owner_id",
    "p_draft_id",
    "p_expected_version",
    "p_data",
  ],
  reserve_draft_media: ["p_owner", "p_draft", "p_id", "p_type", "p_size"],
  register_draft_media: [
    "p_owner",
    "p_draft",
    "p_id",
    "p_width",
    "p_height",
    "p_size",
  ],
  expired_draft_media: ["p_owner", "p_draft"],
  reserve_razorpay_test_order: ["p_owner_id", "p_invitation_id"],
  claim_razorpay_test_reconciliation: ["p_owner_id", "p_id"],
  authorize_razorpay_test_checkout: [
    "p_owner_id",
    "p_id",
    "p_expected_payment_id",
  ],
  reconcile_razorpay_test_attempts: [
    "p_owner_id",
    "p_order_id",
    "p_attempts",
    "p_checked_at",
  ],
  record_razorpay_test_payment: [
    "p_order_id",
    "p_payment_id",
    "p_amount",
    "p_currency",
    "p_status",
    "p_owner_id",
    "p_event_id",
    "p_request_sha256",
    "p_checked_at",
  ],
  publish_test_invitation: [
    "p_owner",
    "p_id",
    "p_version",
    "p_title",
    "p_slug",
  ],
  get_test_publication: ["p_slug"],
  get_published_invitation: ["p_slug"],
};
const scalarRpc = new Set([
  "reserve_draft_media",
  "register_draft_media",
  "record_razorpay_test_payment",
  "claim_razorpay_test_reconciliation",
  "authorize_razorpay_test_checkout",
  "reconcile_razorpay_test_attempts",
  "publish_test_invitation",
]);

async function bytes(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const transport = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const service = req.headers.apikey === serviceKey;
  const user = users.get(req.headers.authorization?.split(" ")[1]);
  const eq = (name) => {
    const value = url.searchParams.get(name);
    return value?.startsWith("eq.") ? value.slice(3) : null;
  };
  const send = (status, value) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(value));
  };
  async function query(sql, params) {
    return (await db.query(sql, params)).rows;
  }
  try {
    if (url.pathname.startsWith("/v1/")) {
      const basic = Buffer.from(
        "rzp_test_Day06Fixture:" + checkoutSecret,
      ).toString("base64");
      assert.equal(req.headers.authorization, "Basic " + basic);
      if (url.pathname === "/v1/orders" && req.method === "POST") {
        const order = JSON.parse(await bytes(req));
        assert.deepEqual(
          {
            amount: order.amount,
            currency: order.currency,
            partial: order.partial_payment,
          },
          { amount: 89900, currency: "INR", partial: false },
        );
        assert.match(order.receipt, /^test_[0-9a-f]{32}$/);
        const id = "order_Day06Fixture" + (providerOrders.size + 1);
        const created = {
          id,
          receipt: order.receipt,
          amount: order.amount,
          currency: order.currency,
        };
        providerOrders.set(id, created);
        return send(200, created);
      }
      if (url.pathname === "/v1/orders") {
        return send(200, {
          items: [...providerOrders.values()].filter(
            (order) => order.receipt === url.searchParams.get("receipt"),
          ),
        });
      }
      if (failProviderReads) return send(503, {});
      const payment = url.pathname.match(/^\/v1\/payments\/([A-Za-z0-9_]+)$/);
      if (payment) {
        return providerPayments.has(payment[1])
          ? send(200, providerPayments.get(payment[1]))
          : send(404, {});
      }
      const order = url.pathname.match(
        /^\/v1\/orders\/([A-Za-z0-9_]+)\/payments$/,
      );
      if (order) {
        return send(200, {
          items: [...providerPayments.values()].filter(
            (payment) => payment.order_id === order[1],
          ),
        });
      }
      return send(404, {});
    }
    if (url.pathname.startsWith("/test-media/")) {
      assert(url.searchParams.has("X-Amz-Signature"));
      res.setHeader("Access-Control-Allow-Origin", base);
      res.setHeader(
        "Access-Control-Allow-Headers",
        "content-type, if-none-match",
      );
      res.setHeader("Access-Control-Allow-Methods", "PUT");
      if (req.method === "OPTIONS") return res.writeHead(204).end();
      if (req.method === "PUT") {
        if (objects.has(url.pathname)) return res.writeHead(412).end();
        objects.set(url.pathname, {
          body: await bytes(req),
          type: req.headers["content-type"],
        });
        return res.writeHead(200).end();
      }
      const photo = objects.get(url.pathname);
      if (!photo) return res.writeHead(404).end();
      return res
        .writeHead(200, {
          "Content-Type": photo.type,
          "Content-Length": photo.body.length,
        })
        .end(photo.body);
    }
    if (
      url.pathname === "/auth/v1/signup" &&
      req.headers.apikey === publishableKey
    ) {
      const { email } = JSON.parse(await bytes(req));
      const user = {
        id: randomUUID(),
        email,
        role: "authenticated",
        aud: "authenticated",
        is_anonymous: false,
      };
      await db.query("insert into auth.users (id) values ($1)", [user.id]);
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const token = [
        Buffer.from(JSON.stringify({ alg: "HS256" })),
        Buffer.from(
          JSON.stringify({ sub: user.id, exp: expires, role: user.role }),
        ),
        Buffer.from(randomUUID()),
      ]
        .map((value) => value.toString("base64url"))
        .join(".");
      users.set(token, user);
      return send(200, {
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: randomUUID(),
        user,
      });
    }
    if (url.pathname === "/auth/v1/user")
      return user ? send(200, user) : send(401, {});
    if (url.pathname === "/rest/v1/templates" && user)
      return send(
        200,
        await query(
          "select draft_eligible from public.templates where registry_key=$1",
          [eq("registry_key")],
        ),
      );
    if (url.pathname === "/rest/v1/invitations" && user)
      return send(
        200,
        await query(
          `select i.*, to_jsonb(t) as template from public.invitations i join public.templates t on t.id=i.template_id
          where i.owner_id=$1 and ($2::uuid is null or i.id=$2) and i.status=$3 order by i.id`,
          [user.id, eq("id"), eq("status")],
        ),
      );
    if (url.pathname === "/rest/v1/orders" && service) {
      if (req.method === "PATCH") {
        const updates = JSON.parse(await bytes(req));
        return send(
          200,
          await query(
            "update public.orders set gateway_order_id=$4,status=$5,reservation_token=null,reservation_expires_at=null where id=$1 and owner_id=$2 and reservation_token=$3 and status='test_reserving' returning *",
            [
              eq("id"),
              eq("owner_id"),
              eq("reservation_token"),
              updates.gateway_order_id,
              updates.status,
            ],
          ),
        );
      }
      return send(
        200,
        await query(
          "select * from public.orders where ($1::uuid is null or owner_id=$1) and (invitation_id=$2 or gateway_order_id=$3) and status in ('test_created','test_failed','test_processing','test_verified')",
          [eq("owner_id"), eq("invitation_id"), eq("gateway_order_id")],
        ),
      );
    }
    if (url.pathname === "/rest/v1/payment_events" && service) {
      const filter = url.searchParams.get("or");
      const match = filter?.match(
        /^\(gateway_event_id\.eq\.([a-f0-9-]+),request_sha256\.eq\.([a-f0-9]{64})\)$/,
      );
      assert(match);
      return send(
        200,
        await query(
          "select outcome from public.payment_events where (gateway_event_id=$1 or request_sha256=$2) and processed_at is not null limit 2",
          [match[1], match[2]],
        ),
      );
    }
    if (url.pathname === "/rest/v1/draft_media_uploads" && service)
      return send(
        200,
        await query(
          "select * from public.draft_media_uploads where id=$1 and invitation_id=$2 and owner_id=$3",
          [eq("id"), eq("invitation_id"), eq("owner_id")],
        ),
      );
    if (url.pathname === "/rest/v1/assets" && user)
      return send(
        200,
        await query(
          "select * from public.assets where id=$1 and invitation_id=$2 and owner_id=$3 and object_key=$4 and media_type=$5",
          [
            eq("id"),
            eq("invitation_id"),
            user.id,
            eq("object_key"),
            eq("media_type"),
          ],
        ),
      );
    const name = url.pathname.split("/").at(-1);
    if (
      url.pathname.startsWith("/rest/v1/rpc/") &&
      Object.hasOwn(rpc, name) &&
      (service || name === "get_published_invitation")
    ) {
      const input = JSON.parse(await bytes(req));
      const args = rpc[name].map((key) =>
        key === "p_attempts"
          ? JSON.stringify(input[key])
          : (input[key] ?? null),
      );
      const call = `public.${name}(${args.map((_, index) => "$" + (index + 1)).join(",")})`;
      const scalar = scalarRpc.has(name);
      const rows = await query(
        scalar ? `select ${call} as value` : `select * from ${call}`,
        args,
      );
      return send(200, scalar ? rows[0].value : rows);
    }
    console.error("Unexpected fixture request", req.method, url.pathname);
    return send(404, {});
  } catch (error) {
    console.error("Fixture request failed", url.pathname, error.message);
    return send(500, {});
  }
});

function webhook(order, status, signatureValid = true, eventId = randomUUID()) {
  return sendWebhook(
    {
      event: "payment." + status,
      payload: {
        payment: {
          entity: {
            id: "pay_Day06Fixture",
            order_id: order,
            amount: 89900,
            currency: "INR",
            status,
          },
        },
      },
    },
    signatureValid,
    eventId,
  );
}

function sendWebhook(payload, signatureValid = true, eventId = randomUUID()) {
  const raw = JSON.stringify(payload);
  return fetch(base + "/api/webhooks/razorpay", {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Event-Id": eventId,
      "X-Razorpay-Signature": createHmac("sha256", webhookSecret)
        .update(signatureValid ? raw : raw + " ")
        .digest("hex"),
    },
  });
}

function paymentConfirmation(payment) {
  return {
    razorpay_order_id: payment.order_id,
    razorpay_payment_id: payment.id,
    razorpay_signature: createHmac("sha256", checkoutSecret)
      .update(payment.order_id + "|" + payment.id)
      .digest("hex"),
  };
}

async function verifyAttemptIsolation(page, guest, source, body) {
  const scenarios = [
    ["full", "refund-first"],
    ["full", "capture-first"],
    ["partial", "refund-first"],
    ["partial", "capture-first"],
    ["dispute", "refund-first"],
    ["dispute", "capture-first"],
    ["full", "concurrent"],
    ["partial", "owner-reconciliation"],
  ];
  const existingProviderOrders = providerOrders.size;
  for (const [index, [financial, sequence]] of scenarios.entries()) {
    const invitation = randomUUID();
    const order = "order_Isolation" + index;
    const slug = "attempt-isolation-" + index;
    await db.query(
      "insert into public.invitations (id,owner_id,template_id,data) select $1,owner_id,template_id,data - 'coverImage' from public.invitations where id=$2",
      [invitation, source],
    );
    await db.query(
      "insert into public.orders (invitation_id,owner_id,template_id,amount_paise,gateway_order_id,status) select id,owner_id,template_id,89900,$2,'test_created' from public.invitations where id=$1",
      [invitation, order],
    );
    const funding = {
      id: "pay_FundingIsolation" + index,
      order_id: order,
      amount: 89900,
      currency: "INR",
      status: "captured",
      captured: true,
      amount_refunded: 0,
      refund_status: null,
    };
    const earlier = {
      ...funding,
      id: "pay_EarlierIsolation" + index,
      status:
        financial === "full"
          ? "refunded"
          : financial === "partial"
            ? "captured"
            : "authorized",
      captured: financial === "partial",
      amount_refunded:
        financial === "full" ? 89900 : financial === "partial" ? 150 : 0,
      refund_status: financial === "dispute" ? null : financial,
    };
    providerPayments.set(earlier.id, earlier);
    providerPayments.set(funding.id, funding);
    const event =
      financial === "dispute"
        ? {
            event: "payment.dispute.created",
            payload: {
              payment: { entity: earlier },
              dispute: {
                entity: {
                  id: "disp_Isolation" + index,
                  payment_id: earlier.id,
                },
              },
            },
          }
        : {
            event: "refund.processed",
            payload: {
              payment: { entity: earlier },
              refund: {
                entity: {
                  id: "rfnd_Isolation" + index,
                  payment_id: earlier.id,
                  status: "processed",
                },
              },
            },
          };
    const eventId = randomUUID();
    const hold = async () =>
      assert.equal((await sendWebhook(event, true, eventId)).status, 204);
    const capture = async () =>
      assert.equal(
        (
          await sendWebhook({
            event: "payment.captured",
            payload: { payment: { entity: funding } },
          })
        ).status,
        204,
      );
    const callback = async () =>
      assert.deepEqual(
        await post(page, "/api/verify-payment", paymentConfirmation(funding)),
        { status: 200, data: { success: true } },
      );
    if (sequence === "capture-first") {
      await callback();
      await hold();
      await capture();
    } else if (sequence === "concurrent") {
      await Promise.all([hold(), callback()]);
      await capture();
    } else {
      await hold();
      if (sequence === "owner-reconciliation") {
        const status = await page.request.get(
          base + "/api/checkout/" + invitation,
        );
        assert.deepEqual(await status.json(), { state: "verified" });
      } else await capture();
      await callback();
    }
    await hold();
    assert.equal(
      (
        await sendWebhook({
          event: "payment.failed",
          payload: { payment: { entity: { ...earlier, status: "failed" } } },
        })
      ).status,
      204,
    );
    const result = await post(page, "/api/publish/" + invitation, {
      ...body,
      expectedVersion: 1,
      slug,
    });
    assert.deepEqual(result, { status: 200, data: { slug } });
    const guestResponse = await guest.request.get(base + "/i/" + slug);
    assert.equal(guestResponse.status(), 200);
    const html = await guestResponse.text();
    assert(html.includes("Tara") && !html.includes("YUGMA DEMO"));
  }
  assert.equal(providerOrders.size, existingProviderOrders);
  pass(
    "Eight checkout and publication scenarios isolated full refunds, partial refunds and disputes across both delivery orders, duplicates, delayed events, concurrent delivery and owner reconciliation.",
  );
}

const listen = (server) =>
  new Promise((done) => server.listen(0, "127.0.0.1", done));
const close = (server) => new Promise((done) => server.close(done));
const shot = (page, name) =>
  page.screenshot({
    path: resolve(evidence, name + ".png"),
    animations: "disabled",
  });
const role = (page, name, text) =>
  page.getByRole(name, { name: text, exact: true });
const post = (page, path, data) =>
  page.evaluate(
    async ({ path, data }) => {
      const result = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return { status: result.status, data: await result.json() };
    },
    { path, data },
  );

async function signUp(page, localPart) {
  await role(page, "link", "Create an account").click();
  await role(page, "heading", "Create your YUGMA account").waitFor();
  await page.getByLabel("Email address").fill(localPart + "@example.test");
  await page.getByLabel("Password").fill("day-06-browser-fixture");
  await role(page, "button", "Create account").click();
  await page
    .waitForURL("**/studio", { timeout: 12000 })
    .catch(async (error) => {
      const note = await page
        .locator("main")
        .innerText()
        .catch(() => "");
      await shot(page, "signup-error");
      throw new Error(
        `Registration did not reach Studio (${page.url()}). ${note}`,
        { cause: error },
      );
    });
}

try {
  await mkdir(evidence, { recursive: true });
  const directory = resolve(project, "supabase/migrations");
  await db.exec(
    await readFile(resolve(project, "supabase/fixtures/test-auth.sql"), "utf8"),
  );
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile(resolve(directory, name), "utf8"));
  }
  await listen(transport);
  const probe = createServer();
  await listen(probe);
  const port = probe.address().port;
  await close(probe);
  base = "http://127.0.0.1:" + port;
  const dataOrigin = "http://127.0.0.1:" + transport.address().port;
  app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: project,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        SUPABASE_URL: dataOrigin,
        SUPABASE_PUBLISHABLE_KEY: publishableKey,
        SUPABASE_SECRET_KEY: serviceKey,
        R2_ACCOUNT_ID: "0".repeat(32),
        R2_ACCESS_KEY_ID: "fixture-key",
        R2_SECRET_ACCESS_KEY: "fixture-secret",
        R2_PRIVATE_BUCKET: "test-media",
        R2_LOCAL_ENDPOINT: dataOrigin,
        RAZORPAY_KEY_ID: "rzp_test_Day06Fixture",
        NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_Day06Fixture",
        RAZORPAY_KEY_SECRET: checkoutSecret,
        RAZORPAY_TEST_LOCAL_ENDPOINT: dataOrigin,
        RAZORPAY_WEBHOOK_SECRET: webhookSecret,
        STAGING_INVITATION_PUBLISHING: "true",
        SITE_URL: base,
      },
    },
  );
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(base + "/sign-in")
        .then((response) => response.ok)
        .catch(() => false)
    )
      break;
    if (attempt >= 100 || app.exitCode !== null)
      throw new Error("Next.js startup failed");
    await delay(200);
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await desktop.route("https://checkout.razorpay.com/v1/checkout.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.Razorpay = class {
      constructor(options) { this.options = options }
      on() {}
      open() { this.options.handler({ razorpay_order_id: this.options.order_id,
        razorpay_payment_id: "pay_Day06Fixture", razorpay_signature: "0".repeat(64) }) }
    }`,
    }),
  );
  const page = await desktop.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) =>
    console.error("Browser error", error.message),
  );
  await page.goto(base + "/demo/afterglow");
  await page.getByRole("complementary", { name: "Demo preview" }).waitFor();
  await shot(page, "01-sample");
  await role(page, "link", "Open private Studio").click();
  await page.waitForURL("**/sign-in?*");
  await signUp(page, "day06-owner");
  await role(page, "link", "Start a new invitation").click();
  await role(page, "button", "Create private draft").click();
  await page.waitForURL(/\/studio\/[0-9a-f-]+$/);
  const editor = new URL(page.url()).pathname;
  const id = editor.split("/").at(-1);
  const checkout = "/checkout/" + id;
  const review = "/publish/" + id;
  const endpoint = "/api/publish/" + id;
  assert.equal(
    (
      await post(page, endpoint, {
        title: "Incomplete fixture",
        slug: "incomplete-fixture",
        confirmed: true,
        expectedVersion: 1,
      })
    ).status,
    422,
  );
  await page.getByLabel("Partner 1 name").fill("Tara");
  await page.getByLabel("Partner 2 name").fill("Neel");
  await page.getByLabel("Wedding timezone").fill("Asia/Kolkata");
  await role(page, "button", "Add ceremony").click();
  await page.getByLabel("Ceremony name").fill("Wedding ceremony");
  await page.getByLabel("Date and time").fill("2027-12-12T10:00");
  await page.getByLabel("Venue name").fill("The Banyan Courtyard");
  await page.getByLabel("Venue address").fill("12 Fictional Lane, Jaipur");
  await page.getByLabel("Map link").fill("https://maps.example.test/venue");
  await page
    .locator("#studio-photo-file")
    .setInputFiles(resolve(project, "public/invitations/heirloom-demo.jpg"));
  const description = page.getByLabel("Photo description");
  await description.fill("A wedding invitation cover");
  await role(page, "button", "Save draft").click();
  await role(page, "link", "Continue to checkout").waitFor();
  await page.reload();
  await page.getByAltText("A wedding invitation cover").waitFor();
  await role(page, "button", "Preview invitation").click();
  await page.getByRole("complementary", { name: "Demo preview" }).waitFor();
  await role(page, "button", "Back to editor").click();
  await shot(page, "02-studio-saved-photo");
  pass(
    "The sample led to account registration, a new draft, saved ceremony details and a verified cover upload.",
  );

  const row = async () =>
    (await db.query("select * from public.invitations where id=$1", [id]))
      .rows[0];
  const slug = "tara-neel-day-06";
  const guestPath = "/i/" + slug;
  const guestUrl = base + guestPath;
  const body = {
    title: "Tara & Neel",
    slug,
    expectedVersion: (await row()).version,
    confirmed: true,
  };
  assert.equal((await post(page, endpoint, body)).status, 403);
  assert.equal(
    (await post(page, endpoint, { ...body, paid: true })).status,
    400,
  );
  assert.equal(
    (await post(page, endpoint, { ...body, ownerId: (await row()).owner_id }))
      .status,
    400,
  );
  assert.equal((await fetch(guestUrl)).status, 404);
  assert.equal((await fetch(guestUrl + "/cover")).status, 404);
  assert.equal(
    (
      await fetch(base + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    ).status,
    401,
  );
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(base + "/sign-in");
  await signUp(strangerPage, "day06-stranger");
  assert.equal((await post(strangerPage, endpoint, body)).status, 404);
  const photoId = (await row()).data.coverImage.src.split("/").at(-1);
  const privatePhoto = base + "/api/drafts/" + id + "/media/" + photoId;
  assert.equal((await stranger.request.get(privatePhoto)).status(), 404);
  assert.equal((await fetch(privatePhoto)).status, 401);
  assert.equal((await fetch(base + "/api/drafts/" + id)).status, 401);
  await stranger.close();
  pass(
    "Unpaid, signed-out and cross-account publish requests were rejected. Unpublished page and cover returned 404.",
  );

  await page.goto(base + checkout);
  await role(page, "button", "Open Razorpay Test Mode").click();
  await page
    .getByText(
      "We couldn’t verify the checkout response. Check your payment status.",
    )
    .waitFor();
  assert.equal(await role(page, "link", "Review and publish").count(), 0);
  const order = "order_Day06Fixture1";
  assert.equal(providerOrders.size, 1);
  const payment = {
    id: "pay_Day06Fixture",
    order_id: order,
    amount: 89900,
    currency: "INR",
    status: "authorized",
    captured: false,
    amount_refunded: 0,
    refund_status: null,
  };
  providerPayments.set(payment.id, payment);
  const confirmation = paymentConfirmation(payment);
  providerPayments.set(payment.id, { ...payment, status: "failed" });
  assert.equal(
    (await post(page, "/api/verify-payment", confirmation)).data.state,
    "failed",
  );
  providerPayments.set(payment.id, payment);
  assert.deepEqual(await post(page, "/api/create-order", { draftId: id }), {
    status: 409,
    data: { state: "processing" },
  });
  await page.reload();
  await page.getByText("Processing payment. Your draft is saved.").waitFor();
  assert.equal(await role(page, "button", "Retry test payment").count(), 0);
  assert.equal(
    (await post(page, "/api/verify-payment", confirmation)).status,
    409,
  );
  await page.getByText("Processing payment. Your draft is saved.").waitFor();
  await shot(page, "03-payment-processing");
  assert.equal((await webhook(order, "captured", false)).status, 401);
  assert.equal((await post(page, endpoint, body)).status, 403);
  const eventId = randomUUID();
  assert.equal((await webhook(order, "captured", true, eventId)).status, 503);
  assert.equal(
    (await db.query("select count(*)::int as count from public.payment_events"))
      .rows[0].count,
    0,
  );

  await page.goto(base + "/studio");
  providerPayments.set(payment.id, {
    ...payment,
    status: "captured",
    captured: true,
  });
  // Return in a clean browser context with the owner session but no callback/sessionStorage.
  const returning = await browser.newContext({
    storageState: await desktop.storageState(),
  });
  const returnPage = await returning.newPage();
  await returnPage.goto(base + checkout);
  await role(returnPage, "link", "Review and publish").waitFor({
    timeout: 30000,
  });
  await returning.close();
  await page.goto(base + checkout);
  await role(page, "link", "Review and publish").waitFor();
  assert.equal((await fetch(guestUrl)).status, 404);

  failProviderReads = true;
  assert.equal((await webhook(order, "captured", true, eventId)).status, 503);
  failProviderReads = false;
  const duplicate = await Promise.all([
    webhook(order, "captured", true, eventId),
    webhook(order, "captured", true, eventId),
    webhook(order, "captured", true),
  ]);
  assert(duplicate.every((response) => response.status === 204));
  const confirmed = await db.query(
    "select status,gateway_payment_id,test_verification_source from public.orders where invitation_id=$1",
    [id],
  );
  assert.deepEqual(confirmed.rows, [
    {
      status: "test_verified",
      gateway_payment_id: payment.id,
      test_verification_source: "owner_check",
    },
  ]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from public.payment_events where outcome='verified'",
      )
    ).rows[0].count,
    1,
  );
  await shot(page, "04-payment-verified");
  pass(
    "A server-priced order, invalid callback, authorization-only denial, delayed capture, owner return without sessionStorage, retryable outage and concurrent webhook replays passed.",
  );
  await role(page, "link", "Review and publish").click();
  await role(page, "link", "Edit draft").click();
  await page
    .getByLabel("Welcome message")
    .fill("We look forward to celebrating with you.");
  await role(page, "button", "Save draft").click();
  await role(page, "link", "Continue to checkout").waitFor();
  assert.equal((await post(page, endpoint, body)).status, 409);
  await page.goto(base + review);
  await page.getByText("We look forward to celebrating with you.").waitFor();
  await page.getByLabel("Link ending").fill(slug);
  await page.getByRole("checkbox").check();
  await shot(page, "05-publish-review");
  await role(page, "button", "Publish invitation").click();
  await role(page, "heading", "Invitation published").waitFor();
  await role(page, "button", "Copy link").click();
  await page.getByText("Link copied.").waitFor();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    guestUrl,
  );
  assert.match(
    new URL(
      await role(page, "link", "Open WhatsApp").getAttribute("href"),
    ).searchParams.get("text"),
    /Tara & Neel/,
  );
  await shot(page, "06-desktop-share");
  pass(
    "The verified owner edited before publishing. An older review was rejected. Desktop copied the public URL.",
  );

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    permissions: ["clipboard-read", "clipboard-write"],
    storageState: await desktop.storageState(),
  });
  await mobile.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: async (payload) => {
        window.sharedInvitation = payload;
      },
    });
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(base + review);
  await role(mobilePage, "button", "Copy link").click();
  await mobilePage.getByText("Link copied.").waitFor();
  assert.equal(
    await mobilePage.evaluate(() => navigator.clipboard.readText()),
    guestUrl,
  );
  await role(mobilePage, "button", "Share invitation").click();
  assert.equal(
    await mobilePage.evaluate(() => window.sharedInvitation.url),
    guestUrl,
  );
  await shot(mobilePage, "07-mobile-share");
  const guest = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const publicPage = await guest.newPage();
  const guestResponse = await publicPage.goto(guestUrl);
  assert.equal(guestResponse.status(), 200);
  assert.match(guestResponse.headers()["cache-control"], /no-store/);
  await role(publicPage, "heading", "Tara & Neel").waitFor();
  assert.equal(
    await publicPage
      .getByRole("complementary", { name: "Demo preview" })
      .count(),
    0,
  );
  const cover = publicPage.getByAltText("A wedding invitation cover");
  await cover.waitFor();
  assert.equal(
    new URL(await cover.getAttribute("src"), guestUrl).href,
    guestUrl + "/cover",
  );
  const directions = publicPage.getByRole("link", { name: /Get directions/i });
  assert.equal(
    await directions.getAttribute("href"),
    "https://maps.example.test/venue",
  );
  const guestHtml = await publicPage.content();
  assert(
    !guestHtml.includes("/api/drafts/") && !guestHtml.includes("draft-media/"),
  );
  assert.equal(
    await publicPage
      .locator('meta[property="og:title"]')
      .getAttribute("content"),
    "Tara & Neel",
  );
  assert.equal(
    await publicPage.locator('link[rel="canonical"]').getAttribute("href"),
    guestUrl,
  );
  assert.equal(
    (await guest.request.get(guestUrl + "/cover")).headers()["content-type"],
    "image/webp",
  );
  await shot(publicPage, "08-incognito-public");
  pass(
    "Mobile copy and Web Share received the correct URL. A fresh anonymous context rendered the cover, metadata and invitation without a watermark.",
  );

  await page.goto(base + editor);
  await page.waitForURL(base + review);
  await role(page, "heading", "Invitation published").waitFor();
  const retry = await post(page, endpoint, {
    ...body,
    slug: "different-link",
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.slug, slug);
  await page.goto(base + "/studio");
  await role(page, "link", "View and share").waitFor();
  await verifyAttemptIsolation(page, guest, id, body);
  assert.equal(
    (
      await sendWebhook({
        event: "payment.dispute.created",
        payload: {
          payment: { entity: payment },
          dispute: {
            entity: { id: "disp_FundingFixture", payment_id: payment.id },
          },
        },
      })
    ).status,
    204,
  );
  assert.equal((await guest.request.get(guestUrl)).status(), 404);
  assert.equal((await guest.request.get(guestUrl + "/cover")).status(), 404);
  const refundNotice = {
    event: "refund.processed",
    payload: {
      payment: { entity: { ...payment, status: "captured" } },
      refund: {
        entity: {
          id: "rfnd_Day06Partial",
          payment_id: payment.id,
          status: "processed",
        },
      },
    },
  };
  const refundId = randomUUID();
  providerPayments.set(payment.id, {
    ...payment,
    status: "captured",
    captured: true,
    amount_refunded: 150,
    refund_status: "partial",
  });
  failProviderReads = true;
  assert.equal((await sendWebhook(refundNotice, true, refundId)).status, 503);
  const held = await guest.request.get(guestUrl);
  assert.equal(held.status(), 404);
  assert.match(held.headers()["cache-control"], /no-store/);
  assert(!/og:title[^>]*Tara|draft-media\//.test(await held.text()));
  assert.equal((await guest.request.get(guestUrl + "/cover")).status(), 404);
  assert.equal((await post(page, endpoint, body)).status, 403);
  failProviderReads = false;
  assert.equal((await sendWebhook(refundNotice, true, refundId)).status, 204);
  assert.equal((await sendWebhook(refundNotice, true, refundId)).status, 204);

  providerPayments.set(payment.id, {
    ...payment,
    status: "captured",
    captured: true,
  });
  assert.equal((await webhook(order, "captured")).status, 204);
  assert.equal((await guest.request.get(guestUrl)).status(), 404);
  await page.goto(base + review);
  await role(page, "heading", "Guest access unavailable").waitFor();
  await role(page, "heading", "Tara & Neel").waitFor();
  const privateCover = page.getByAltText("A wedding invitation cover");
  await privateCover.waitFor();
  const privatePhotoUrl = new URL(await privateCover.getAttribute("src"), base)
    .href;
  assert.equal((await desktop.request.get(privatePhotoUrl)).status(), 200);
  assert.equal((await guest.request.get(privatePhotoUrl)).status(), 401);
  providerPayments.set(payment.id, {
    ...payment,
    status: "refunded",
    captured: true,
    amount_refunded: 89900,
    refund_status: "full",
  });
  assert.equal(
    (
      await sendWebhook({
        ...refundNotice,
        payload: {
          ...refundNotice.payload,
          refund: {
            entity: {
              id: "rfnd_Day06Full",
              payment_id: payment.id,
              status: "processed",
            },
          },
        },
      })
    ).status,
    204,
  );
  assert.deepEqual(
    (
      await db.query(
        "select o.status, o.test_entitlement, i.share_slug from public.orders o join public.invitations i on i.id=o.invitation_id where o.invitation_id=$1",
        [id],
      )
    ).rows,
    [
      {
        status: "test_verified",
        test_entitlement: "revoked",
        share_slug: slug,
      },
    ],
  );
  assert.equal((await guest.request.get(guestUrl)).status(), 404);
  assert.equal((await guest.request.get(guestUrl + "/cover")).status(), 404);
  pass(
    "Late authorization held checkout after reload. Partial and full refunds removed guest content, metadata and cover while preserving the owner preview, receipt and slug.",
  );
  await db.query("update public.invitations set status='revoked' where id=$1", [
    id,
  ]);
  assert.equal((await guest.request.get(guestUrl)).status(), 404);
  assert.equal((await guest.request.get(guestUrl + "/cover")).status(), 404);
  await db.query(
    "delete from public.payment_events where order_id in (select id from public.orders where invitation_id=$1)",
    [id],
  );
  for (const table of ["assets", "orders"])
    await db.query(`delete from public.${table} where invitation_id=$1`, [id]);
  await db.query("delete from public.invitations where id=$1", [id]);
  assert.equal((await guest.request.get(guestUrl)).status(), 404);
  assert.equal((await guest.request.get(guestUrl + "/cover")).status(), 404);
  pass(
    "The editor and Studio returned to sharing. Duplicate publish returned the original slug. Revocation and deletion removed the page and photo.",
  );
  await writeFile(
    resolve(evidence, "playwright-results.json"),
    JSON.stringify(
      {
        environment:
          "Loopback production build, PostgreSQL via PGlite, fixture Supabase Auth and R2, signed webhook and authoritative provider HTTP fixtures",
        routes: { editor, checkout, review, public: guestPath },
        checks,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser?.close();
  app?.kill();
  await close(transport);
  await db.close();
}
