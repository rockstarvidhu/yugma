// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRazorpayTestConfig } from "./gateway";
import { createOrder, verifyPayment } from "./http";

const mocks = vi.hoisted(() => ({
  getVerifiedSession: vi.fn(),
  createServiceClient: vi.fn(),
  getTestGateway: vi.fn(),
  loadAfterglowCheckoutDraft: vi.fn(),
  findTestOrder: vi.fn(),
  insertTestOrder: vi.fn(),
  recordTestPayment: vi.fn(),
  createGatewayOrder: vi.fn(),
  fetchGatewayPayment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({
  getVerifiedSession: mocks.getVerifiedSession,
}));
vi.mock("@/lib/auth/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("./store", () => ({
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
const order = {
  id: "e4000000-0000-4000-8000-000000000001",
  gateway_order_id: "order_Fixture123",
  gateway_payment_id: null,
  amount_paise: 89900,
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
      orders: { create: mocks.createGatewayOrder },
      payments: { fetch: mocks.fetchGatewayPayment },
    },
    keySecret: secret,
  });
  mocks.loadAfterglowCheckoutDraft.mockResolvedValue({
    id: draftId,
    templateId,
  });
  mocks.findTestOrder.mockResolvedValue(order);
  mocks.insertTestOrder.mockResolvedValue(order);
  mocks.createGatewayOrder.mockResolvedValue({
    id: order.gateway_order_id,
    amount: 89900,
    currency: "INR",
  });
  mocks.fetchGatewayPayment.mockResolvedValue(payment);
  mocks.recordTestPayment.mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("Razorpay Test Mode routes", () => {
  it("creates an owner-scoped INR order at the server price", async () => {
    mocks.findTestOrder.mockResolvedValue(null);
    const result = await createOrder(request({ draftId }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      order_id: order.gateway_order_id,
      amount: 89900,
      currency: "INR",
    });
    expect(mocks.createGatewayOrder).toHaveBeenCalledWith({
      amount: 89900,
      currency: "INR",
      receipt: expect.stringMatching(/^test_[a-f0-9]{32}$/),
      partial_payment: false,
    });
    expect(mocks.insertTestOrder).toHaveBeenCalledWith(
      db,
      ownerId,
      { id: draftId, templateId },
      order.gateway_order_id,
      89900,
    );
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
    expect((await createOrder(request({ draftId, amount: 1 }))).status).toBe(
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
    [{ status: "authorized" }, 409],
  ])("rejects a payment with %j", async (override, expected) => {
    mocks.fetchGatewayPayment.mockResolvedValue({ ...payment, ...override });
    expect((await verifyPayment(request(confirmation))).status).toBe(expected);
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
  });

  it("records the matching capture and accepts a signed replay without writing twice", async () => {
    const first = await verifyPayment(request(confirmation));
    expect(await first.json()).toEqual({ success: true });
    expect(mocks.recordTestPayment).toHaveBeenCalledWith(
      db,
      ownerId,
      order,
      payment.id,
    );
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

  it("requires matching Test Mode key IDs for both sides", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", secret);
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_Fixture");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_Different");
    expect(getRazorpayTestConfig()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_Fixture");
    expect(getRazorpayTestConfig()?.keyId).toBe("rzp_test_Fixture");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_Fixture");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_live_Fixture");
    expect(getRazorpayTestConfig()).toBeNull();
  });
});
