// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRazorpayTestConfig } from "./gateway";
import {
  createOrder,
  getCheckoutStatus,
  razorpayWebhook,
  verifyPayment,
} from "./http";

const mocks = vi.hoisted(() => ({
  getVerifiedSession: vi.fn(),
  createServiceClient: vi.fn(),
  getTestGateway: vi.fn(),
  loadAfterglowCheckoutDraft: vi.fn(),
  findTestOrder: vi.fn(),
  insertTestOrder: vi.fn(),
  recordTestPayment: vi.fn(),
  createGatewayOrder: vi.fn(),
  listGatewayOrders: vi.fn(),
  fetchGatewayPayment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({
  getVerifiedSession: mocks.getVerifiedSession,
}));
vi.mock("@/lib/auth/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("./store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./store")>()),
  loadAfterglowCheckoutDraft: mocks.loadAfterglowCheckoutDraft,
  findTestOrder: mocks.findTestOrder,
  insertTestOrder: mocks.insertTestOrder,
  recordTestPayment: mocks.recordTestPayment,
}));
vi.mock("./gateway", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./gateway")>()),
  getTestGateway: mocks.getTestGateway,
}));

const draftId = "e1000000-0000-4000-8000-000000000001";
const templateId = "e2000000-0000-4000-8000-000000000001";
const ownerId = "e3000000-0000-4000-8000-000000000001";
const db = {};
const secret = "fictional-test-signing-secret";
const webhookSecret = "fictional-webhook-signing-secret";
const keyId = "rzp_test_Fixture";
const cataloguePrice = 98_765;
const order = {
  id: "e4000000-0000-4000-8000-000000000001",
  gateway_order_id: "order_Fixture123",
  gateway_payment_id: null,
  amount_paise: cataloguePrice,
  currency: "INR",
  status: "test_created",
};
const payment = {
  id: "pay_CapturedFixture",
  order_id: order.gateway_order_id,
  amount: order.amount_paise,
  currency: order.currency,
  status: "captured",
};
const confirmation = {
  razorpay_order_id: order.gateway_order_id,
  razorpay_payment_id: payment.id,
  razorpay_signature: createHmac("sha256", secret)
    .update(`${order.gateway_order_id}|${payment.id}`)
    .digest("hex"),
};

function request(body: unknown) {
  return new Request("http://localhost/api/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getVerifiedSession.mockResolvedValue({ client: {}, ownerId });
  mocks.createServiceClient.mockReturnValue(db);
  mocks.getTestGateway.mockReturnValue({
    sdk: {
      orders: {
        create: mocks.createGatewayOrder,
        all: mocks.listGatewayOrders,
      },
      payments: { fetch: mocks.fetchGatewayPayment },
    },
    keySecret: secret,
    keyId,
  });
  mocks.loadAfterglowCheckoutDraft.mockResolvedValue({
    id: draftId,
    templateId,
    amount: cataloguePrice,
    currency: "INR",
  });
  mocks.findTestOrder.mockResolvedValue(order);
  mocks.insertTestOrder.mockResolvedValue(order);
  mocks.createGatewayOrder.mockResolvedValue({
    id: order.gateway_order_id,
    amount: cataloguePrice,
    currency: "INR",
  });
  mocks.fetchGatewayPayment.mockResolvedValue(payment);
  mocks.listGatewayOrders.mockResolvedValue({ items: [] });
  mocks.recordTestPayment.mockResolvedValue("verified");
});

afterEach(() => vi.unstubAllEnvs());

describe("Razorpay Test Mode routes", () => {
  it("creates an owner-scoped INR order at the server price", async () => {
    mocks.findTestOrder.mockResolvedValue(null);
    const result = await createOrder(request({ draftId }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      order_id: order.gateway_order_id,
      amount: cataloguePrice,
      currency: "INR",
      key_id: keyId,
    });
    expect(mocks.createGatewayOrder).toHaveBeenCalledWith({
      amount: cataloguePrice,
      currency: "INR",
      receipt: expect.stringMatching(/^test_[a-f0-9]{32}$/),
      partial_payment: false,
    });
    expect(mocks.insertTestOrder).toHaveBeenCalledWith(
      db,
      ownerId,
      { id: draftId, templateId, amount: cataloguePrice, currency: "INR" },
      order.gateway_order_id,
    );
  });

  it("recovers the same server receipt if Razorpay created the order before a lost response", async () => {
    mocks.findTestOrder.mockResolvedValue(null);
    mocks.createGatewayOrder.mockRejectedValue(
      new Error("gateway connection closed"),
    );
    const receipt = `test_${draftId.replaceAll("-", "")}`;
    mocks.listGatewayOrders.mockResolvedValue({
      items: [
        {
          id: order.gateway_order_id,
          amount: cataloguePrice,
          currency: "INR",
          receipt,
        },
      ],
    });
    expect((await createOrder(request({ draftId }))).status).toBe(200);
    expect(mocks.listGatewayOrders).toHaveBeenCalledWith({
      receipt,
      count: 10,
    });
  });

  it("reuses the local order for a retry and stops after verification", async () => {
    expect((await createOrder(request({ draftId }))).status).toBe(200);
    mocks.findTestOrder.mockResolvedValue({
      ...order,
      status: "test_verified",
    });
    expect((await createOrder(request({ draftId }))).status).toBe(409);
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
  });

  it("rejects unauthorized requests, a client-supplied amount and an inaccessible draft", async () => {
    mocks.getVerifiedSession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    expect((await createOrder(request({ draftId }))).status).toBe(401);
    expect((await verifyPayment(request(confirmation))).status).toBe(401);
    for (const field of [
      { amount: 1 },
      { currency: "USD" },
      { templateId },
      { paid: true },
    ])
      expect((await createOrder(request({ draftId, ...field }))).status).toBe(
        400,
      );
    mocks.loadAfterglowCheckoutDraft.mockResolvedValue(null);
    expect((await createOrder(request({ draftId }))).status).toBe(404);
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
  });

  it("handles gateway errors without revealing internal details", async () => {
    mocks.findTestOrder.mockResolvedValueOnce(null);
    mocks.createGatewayOrder.mockRejectedValue(new Error("internal details"));
    const result = await createOrder(request({ draftId }));
    expect(result.status).toBe(500);
    expect((await result.json()).error).not.toContain("internal details");
  });

  it("rejects missing fields, invalid signatures and unowned orders before fetching a payment", async () => {
    const { razorpay_signature, ...incomplete } = confirmation;
    expect((await verifyPayment(request(incomplete))).status).toBe(400);
    const wrongSignature =
      (razorpay_signature[0] === "0" ? "1" : "0") + razorpay_signature.slice(1);
    expect(
      (
        await verifyPayment(
          request({ ...confirmation, razorpay_signature: wrongSignature }),
        )
      ).status,
    ).toBe(400);
    mocks.findTestOrder.mockResolvedValueOnce(null);
    expect((await verifyPayment(request(confirmation))).status).toBe(404);
    expect(mocks.fetchGatewayPayment).not.toHaveBeenCalled();
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
  });

  it.each([
    [{ amount: 100 }, 400],
    [{ currency: "USD" }, 400],
    [{ order_id: "order_Other" }, 400],
  ])("rejects a payment with %j", async (override, expected) => {
    mocks.fetchGatewayPayment.mockResolvedValue({ ...payment, ...override });
    expect((await verifyPayment(request(confirmation))).status).toBe(expected);
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
  });

  it("keeps an authorization pending and records a provider-confirmed failure", async () => {
    for (const [providerStatus, state, status] of [
      ["authorized", "processing", 202],
      ["failed", "failed", 200],
    ] as const) {
      mocks.fetchGatewayPayment.mockResolvedValue({
        ...payment,
        status: providerStatus,
      });
      mocks.recordTestPayment.mockResolvedValue(state);
      const result = await verifyPayment(request(confirmation));
      expect(result.status).toBe(status);
      expect(await result.json()).toEqual({ state });
    }
  });

  it("records the matching capture and accepts a signed replay without writing twice", async () => {
    const first = await verifyPayment(request(confirmation));
    expect(await first.json()).toEqual({ success: true });
    expect(mocks.recordTestPayment).toHaveBeenCalledWith(db, payment, {
      ownerId,
    });
    mocks.findTestOrder.mockResolvedValue({
      ...order,
      status: "test_verified",
      gateway_payment_id: payment.id,
    });
    const again = await verifyPayment(request(confirmation));
    expect(await again.json()).toEqual({ success: true });
    expect(mocks.recordTestPayment).toHaveBeenCalledTimes(1);
    expect(mocks.fetchGatewayPayment).toHaveBeenCalledTimes(1);
  });

  it("requires a Test Mode key and a server-side secret", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    vi.stubEnv("RAZORPAY_KEY_ID", keyId);
    expect(getRazorpayTestConfig()).toBeNull();
    vi.stubEnv("RAZORPAY_KEY_SECRET", secret);
    expect(getRazorpayTestConfig()?.keyId).toBe(keyId);
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_Fixture");
    expect(getRazorpayTestConfig()).toBeNull();
  });

  it("returns payment status only to the authenticated draft owner", async () => {
    mocks.getVerifiedSession.mockResolvedValueOnce(null);
    expect((await getCheckoutStatus(draftId)).status).toBe(401);
    mocks.loadAfterglowCheckoutDraft.mockResolvedValueOnce(null);
    expect((await getCheckoutStatus(draftId)).status).toBe(404);
    mocks.findTestOrder.mockResolvedValue({
      ...order,
      status: "test_verified",
    });
    const status = await getCheckoutStatus(draftId);
    expect(status.headers.get("cache-control")).toBe("private, no-store");
    expect(await status.json()).toEqual({ state: "verified" });
    expect(mocks.findTestOrder).toHaveBeenCalledExactlyOnceWith(db, ownerId, {
      draftId,
    });
  });
});

describe("Razorpay payment webhooks", () => {
  const raw = JSON.stringify(
    { event: "payment.captured", payload: { payment: { entity: payment } } },
    null,
    2,
  );
  const sign = (body: string) =>
    createHmac("sha256", webhookSecret).update(body).digest("hex");
  function webhook(body: string, signature = sign(body)) {
    return new Request("http://localhost/api/webhooks/razorpay", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": signature,
        "X-Razorpay-Event-Id": "evt_Fixture",
      },
    });
  }
  beforeEach(() => vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", webhookSecret));

  it("rejects changed bytes and checks the signature before trying to parse JSON", async () => {
    expect((await razorpayWebhook(webhook(raw + "\n", sign(raw)))).status).toBe(
      401,
    );
    expect((await razorpayWebhook(webhook("{", sign(raw)))).status).toBe(401);
    expect((await razorpayWebhook(webhook("{"))).status).toBe(400);
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
  });

  it("acknowledges a signed capture or signed replay after durable handling", async () => {
    expect((await razorpayWebhook(webhook(raw))).status).toBe(204);
    expect(mocks.recordTestPayment).toHaveBeenCalledWith(db, payment, {
      eventId: "evt_Fixture",
    });
    expect(mocks.getVerifiedSession).not.toHaveBeenCalled();
    mocks.recordTestPayment.mockResolvedValueOnce("duplicate");
    expect((await razorpayWebhook(webhook(raw))).status).toBe(204);
    mocks.recordTestPayment.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    expect((await razorpayWebhook(webhook(raw))).status).toBe(503);
  });
});
