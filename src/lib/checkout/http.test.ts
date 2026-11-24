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
  reserveTestOrder: vi.fn(),
  attachGatewayTestOrder: vi.fn(),
  authorizeTestCheckout: vi.fn(),
  recordTestPayment: vi.fn(),
  createGatewayOrder: vi.fn(),
  listGatewayOrders: vi.fn(),
  fetchGatewayPayment: vi.fn(),
  fetchOrderPayments: vi.fn(),
  claimTestReconciliation: vi.fn(),
  recordedWebhook: vi.fn(),
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
  reserveTestOrder: mocks.reserveTestOrder,
  attachGatewayTestOrder: mocks.attachGatewayTestOrder,
  authorizeTestCheckout: mocks.authorizeTestCheckout,
  recordTestPayment: mocks.recordTestPayment,
  claimTestReconciliation: mocks.claimTestReconciliation,
  recordedWebhook: mocks.recordedWebhook,
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
  test_entitlement: null,
};
const reservation = {
  id: order.id,
  amount_paise: cataloguePrice,
  currency: "INR",
  reservation_token: "e5000000-0000-4000-8000-000000000001",
  recovering: false,
};
const receipt = `test_${reservation.id.replaceAll("-", "")}`;
const payment = {
  id: "pay_CapturedFixture",
  order_id: order.gateway_order_id,
  amount: order.amount_paise,
  currency: order.currency,
  status: "captured",
};
const gatewayPayment = {
  ...payment,
  captured: true,
  amount_refunded: 0,
  refund_status: null,
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
    orders: {
      create: mocks.createGatewayOrder,
      all: mocks.listGatewayOrders,
    },
    keySecret: secret,
    fetchPayment: mocks.fetchGatewayPayment,
    fetchOrderPayments: mocks.fetchOrderPayments,
  });
  mocks.loadAfterglowCheckoutDraft.mockResolvedValue({
    id: draftId,
    templateId,
    amount: cataloguePrice,
    currency: "INR",
  });
  mocks.findTestOrder.mockResolvedValue(order);
  mocks.reserveTestOrder.mockResolvedValue(reservation);
  mocks.attachGatewayTestOrder.mockResolvedValue(order);
  mocks.authorizeTestCheckout.mockResolvedValue(true);
  mocks.createGatewayOrder.mockResolvedValue({
    id: order.gateway_order_id,
    amount: cataloguePrice,
    currency: "INR",
    receipt,
  });
  mocks.fetchGatewayPayment.mockResolvedValue(gatewayPayment);
  mocks.fetchOrderPayments.mockResolvedValue({ items: [] });
  mocks.claimTestReconciliation.mockResolvedValue(false);
  mocks.recordedWebhook.mockResolvedValue(false);
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
    });
    expect(mocks.createGatewayOrder).toHaveBeenCalledWith({
      amount: cataloguePrice,
      currency: "INR",
      receipt,
      partial_payment: false,
    });
    expect(mocks.reserveTestOrder).toHaveBeenCalledWith(db, ownerId, draftId);
    expect(mocks.attachGatewayTestOrder).toHaveBeenCalledWith(
      db,
      ownerId,
      reservation,
      order.gateway_order_id,
    );
  });

  it("recovers the same server receipt if Razorpay created the order before a lost response", async () => {
    mocks.findTestOrder.mockResolvedValue(null);
    mocks.reserveTestOrder.mockResolvedValue({
      ...reservation,
      recovering: true,
    });
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
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
  });

  it("leaves provider creation to the current reservation holder", async () => {
    mocks.findTestOrder.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.reserveTestOrder.mockResolvedValue(null);
    expect((await createOrder(request({ draftId }))).status).toBe(503);
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
    expect(mocks.attachGatewayTestOrder).not.toHaveBeenCalled();
  });

  it("rejects provider orders with a different amount or receipt", async () => {
    mocks.findTestOrder.mockResolvedValue(null);
    for (const override of [{ amount: 100 }, { receipt: "another-receipt" }]) {
      mocks.createGatewayOrder.mockResolvedValue({
        id: order.gateway_order_id,
        amount: cataloguePrice,
        currency: "INR",
        receipt,
        ...override,
      });
      expect((await createOrder(request({ draftId }))).status).toBe(500);
    }
    expect(mocks.attachGatewayTestOrder).not.toHaveBeenCalled();
  });

  it("reuses the local order for a retry and stops after verification", async () => {
    expect((await createOrder(request({ draftId }))).status).toBe(200);
    mocks.findTestOrder.mockResolvedValue({
      ...order,
      status: "test_verified",
      test_entitlement: "active",
    });
    expect((await createOrder(request({ draftId }))).status).toBe(409);
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
  });

  it("holds a direct retry when the failed payment has been authorized since the last status check", async () => {
    mocks.findTestOrder.mockResolvedValue({
      ...order,
      status: "test_failed",
      gateway_payment_id: payment.id,
    });
    const authorized = {
      ...gatewayPayment,
      status: "authorized",
      captured: false,
    };
    mocks.fetchOrderPayments.mockResolvedValue({ items: [authorized] });
    mocks.recordTestPayment.mockResolvedValue("processing");
    const response = await createOrder(request({ draftId }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ state: "processing" });
    expect(mocks.recordTestPayment).toHaveBeenCalledWith(
      db,
      { ...payment, status: "authorized" },
      { ownerId },
      expect.any(String),
    );
    expect(mocks.authorizeTestCheckout).not.toHaveBeenCalled();
    expect(mocks.createGatewayOrder).not.toHaveBeenCalled();
  });

  it("denies a retry if the locked order no longer matches the definitive provider failure", async () => {
    mocks.findTestOrder.mockResolvedValue({
      ...order,
      status: "test_failed",
      gateway_payment_id: payment.id,
    });
    mocks.fetchOrderPayments.mockResolvedValue({
      items: [{ ...gatewayPayment, status: "failed", captured: false }],
    });
    mocks.authorizeTestCheckout.mockResolvedValue(false);
    const response = await createOrder(request({ draftId }));
    expect(response.status).toBe(409);
    expect(mocks.authorizeTestCheckout).toHaveBeenCalledWith(
      db,
      ownerId,
      order.id,
      payment.id,
    );
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
    [{ id: "pay_Other" }, 400],
  ])("rejects a payment with %j", async (override, expected) => {
    mocks.fetchGatewayPayment.mockResolvedValue({
      ...gatewayPayment,
      ...override,
    });
    expect((await verifyPayment(request(confirmation))).status).toBe(expected);
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
  });

  it("keeps an authorization pending and records a provider-confirmed failure", async () => {
    for (const [providerStatus, state, status] of [
      ["authorized", "processing", 409],
      ["failed", "failed", 200],
    ] as const) {
      mocks.fetchGatewayPayment.mockResolvedValue({
        ...gatewayPayment,
        captured: false,
        status: providerStatus,
      });
      mocks.recordTestPayment.mockResolvedValue(state);
      const result = await verifyPayment(request(confirmation));
      expect(result.status).toBe(status);
      expect(await result.json()).toEqual({ state });
    }
  });

  it("rechecks a signed replay against the provider with the same atomic receipt", async () => {
    const first = await verifyPayment(request(confirmation));
    expect(await first.json()).toEqual({ success: true });
    expect(mocks.recordTestPayment).toHaveBeenCalledWith(db, payment, {
      ownerId,
    });
    mocks.findTestOrder.mockResolvedValue({
      ...order,
      status: "test_verified",
      gateway_payment_id: payment.id,
      test_entitlement: "active",
    });
    const again = await verifyPayment(request(confirmation));
    expect(await again.json()).toEqual({ success: true });
    expect(mocks.recordTestPayment).toHaveBeenCalledTimes(2);
    expect(mocks.fetchGatewayPayment).toHaveBeenCalledTimes(2);
  });

  it.each([{ status: "captured", captured: false }])(
    "does not fulfil ambiguous capture evidence %j",
    async (change) => {
      mocks.fetchGatewayPayment.mockResolvedValue({
        ...gatewayPayment,
        ...change,
      });
      expect((await verifyPayment(request(confirmation))).status).toBe(409);
      expect(mocks.recordTestPayment).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ status: "refunded", amount_refunded: cataloguePrice }, "revoked"],
    [{ refund_status: "partial", amount_refunded: 100 }, "suspended"],
    [{ refund_status: "full", amount_refunded: 0 }, "suspended"],
  ] as const)(
    "reconciles refund evidence for an already verified receipt %j",
    async (change, outcome) => {
      mocks.findTestOrder.mockResolvedValue({
        ...order,
        status: "test_verified",
        gateway_payment_id: payment.id,
        test_entitlement: "active",
      });
      mocks.claimTestReconciliation.mockResolvedValue(true);
      mocks.fetchGatewayPayment.mockResolvedValue({
        ...gatewayPayment,
        ...change,
      });
      mocks.recordTestPayment.mockResolvedValue(outcome);
      expect(await (await getCheckoutStatus(draftId)).json()).toEqual({
        state: outcome,
      });
      const callback = await verifyPayment(request(confirmation));
      expect(callback.status).toBe(409);
      expect(await callback.json()).toEqual({ state: outcome });
      expect(mocks.recordTestPayment).toHaveBeenCalledWith(
        db,
        { ...payment, status: outcome },
        { ownerId },
      );
    },
  );

  it("records a definitive provider cancellation without granting entitlement", async () => {
    mocks.fetchGatewayPayment.mockResolvedValue({
      ...gatewayPayment,
      status: "cancelled",
      captured: false,
    });
    mocks.recordTestPayment.mockResolvedValue("failed");
    expect(await (await verifyPayment(request(confirmation))).json()).toEqual({
      state: "failed",
    });
    expect(mocks.recordTestPayment).toHaveBeenCalledWith(
      db,
      { ...payment, status: "failed" },
      { ownerId },
      expect.any(String),
    );
  });

  it("recovers a matching capture on return without a browser receipt or webhook", async () => {
    mocks.claimTestReconciliation.mockResolvedValue(true);
    mocks.fetchOrderPayments.mockResolvedValue({
      items: [
        { ...gatewayPayment, status: "failed", captured: false },
        { ...gatewayPayment, id: "pay_Other", amount: 100 },
        gatewayPayment,
      ],
    });
    expect(await (await getCheckoutStatus(draftId)).json()).toEqual({
      state: "verified",
    });
    expect(mocks.fetchOrderPayments).toHaveBeenCalledExactlyOnceWith(
      order.gateway_order_id,
    );
    expect(mocks.claimTestReconciliation).toHaveBeenCalledExactlyOnceWith(
      db,
      ownerId,
      order.id,
    );
    expect(mocks.recordTestPayment).toHaveBeenCalledExactlyOnceWith(
      db,
      payment,
      { ownerId },
    );
  });

  it("preserves pending after a provider timeout and skips reads while throttled", async () => {
    mocks.claimTestReconciliation.mockResolvedValueOnce(true);
    mocks.fetchOrderPayments.mockRejectedValueOnce(new Error("timed out"));
    expect(await (await getCheckoutStatus(draftId)).json()).toEqual({
      state: "pending",
    });
    expect(await (await getCheckoutStatus(draftId)).json()).toEqual({
      state: "pending",
    });
    expect(mocks.fetchOrderPayments).toHaveBeenCalledTimes(1);
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
  });

  it("requires matching Test Mode key IDs and a server-side secret", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    vi.stubEnv("RAZORPAY_KEY_ID", keyId);
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", keyId);
    expect(getRazorpayTestConfig()).toBeNull();
    vi.stubEnv("RAZORPAY_KEY_SECRET", secret);
    expect(getRazorpayTestConfig()?.keyId).toBe(keyId);
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_Different");
    expect(getRazorpayTestConfig()).toBeNull();
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_Fixture");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_live_Fixture");
    expect(getRazorpayTestConfig()).toBeNull();
  });

  it("returns payment status only to the authenticated draft owner", async () => {
    mocks.getVerifiedSession.mockResolvedValueOnce(null);
    expect((await getCheckoutStatus(draftId)).status).toBe(401);
    mocks.findTestOrder.mockResolvedValueOnce(null);
    mocks.loadAfterglowCheckoutDraft.mockResolvedValueOnce(null);
    expect((await getCheckoutStatus(draftId)).status).toBe(404);
    mocks.findTestOrder.mockResolvedValue({
      ...order,
      status: "test_verified",
      test_entitlement: "active",
    });
    const status = await getCheckoutStatus(draftId);
    expect(status.headers.get("cache-control")).toBe("private, no-store");
    expect(await status.json()).toEqual({ state: "verified" });
    expect(mocks.findTestOrder).toHaveBeenLastCalledWith(db, ownerId, {
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
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(mocks.getVerifiedSession).not.toHaveBeenCalled();
    mocks.recordTestPayment.mockResolvedValueOnce("duplicate");
    expect((await razorpayWebhook(webhook(raw))).status).toBe(204);
    mocks.recordTestPayment.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    expect((await razorpayWebhook(webhook(raw))).status).toBe(503);
  });
  it("denies missing and malformed signatures before any provider or database work", async () => {
    expect((await razorpayWebhook(webhook(raw, ""))).status).toBe(401);
    expect((await razorpayWebhook(webhook(raw, "nonsense"))).status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.fetchGatewayPayment).not.toHaveBeenCalled();
  });

  it("acknowledges replay only after finding a committed outcome", async () => {
    mocks.recordedWebhook.mockResolvedValueOnce(true);
    expect((await razorpayWebhook(webhook(raw))).status).toBe(204);
    expect(mocks.fetchGatewayPayment).not.toHaveBeenCalled();
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
  });

  it.each([
    { id: "pay_Wrong" },
    { amount: 1 },
    { currency: "USD" },
    { order_id: "order_Wrong" },
  ])(
    "records a durable ignored outcome for mismatched provider evidence %j",
    async (change) => {
      mocks.fetchGatewayPayment.mockResolvedValue({
        ...gatewayPayment,
        ...change,
      });
      expect((await razorpayWebhook(webhook(raw))).status).toBe(204);
      expect(mocks.recordTestPayment).toHaveBeenCalledExactlyOnceWith(
        db,
        { ...payment, status: "ignored" },
        expect.objectContaining({ eventId: "evt_Fixture" }),
      );
    },
  );

  it("retries after provider timeout, delayed capture, or incomplete order attachment", async () => {
    mocks.findTestOrder.mockResolvedValueOnce(null);
    expect((await razorpayWebhook(webhook(raw))).status).toBe(503);
    mocks.fetchGatewayPayment.mockRejectedValueOnce(
      new Error("provider timeout"),
    );
    expect((await razorpayWebhook(webhook(raw))).status).toBe(503);
    mocks.fetchGatewayPayment.mockResolvedValueOnce({
      ...gatewayPayment,
      captured: false,
      status: "authorized",
    });
    expect((await razorpayWebhook(webhook(raw))).status).toBe(503);
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
    expect((await razorpayWebhook(webhook(raw))).status).toBe(204);
    expect(mocks.recordTestPayment).toHaveBeenCalledTimes(1);
  });

  it("uses current capture evidence even if a signed failed event is delivered late", async () => {
    const delayed = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { ...payment, status: "failed" } } },
    });
    expect((await razorpayWebhook(webhook(delayed))).status).toBe(204);
    expect(mocks.recordTestPayment).toHaveBeenCalledWith(
      db,
      payment,
      expect.objectContaining({ eventId: "evt_Fixture" }),
    );
  });

  function refund(event = "refund.processed", sourcePayment = payment.id) {
    return JSON.stringify({
      event,
      payload: {
        payment: { entity: payment },
        refund: {
          entity: {
            id: "rfnd_Fixture",
            payment_id: sourcePayment,
            status: "processed",
          },
        },
      },
    });
  }

  it("holds a signed refund while provider evidence is unavailable, then revokes on retry", async () => {
    mocks.recordTestPayment.mockResolvedValueOnce("awaiting_verification");
    mocks.fetchGatewayPayment.mockRejectedValueOnce(
      new Error("Provider unavailable"),
    );
    expect((await razorpayWebhook(webhook(refund()))).status).toBe(503);
    expect(mocks.recordTestPayment).toHaveBeenCalledWith(
      db,
      { ...payment, status: "pending_review" },
      expect.objectContaining({ eventId: "evt_Fixture" }),
    );
    mocks.recordTestPayment
      .mockResolvedValueOnce("awaiting_verification")
      .mockResolvedValueOnce("revoked");
    mocks.fetchGatewayPayment.mockResolvedValue({
      ...gatewayPayment,
      amount_refunded: cataloguePrice,
      refund_status: "full",
    });
    expect((await razorpayWebhook(webhook(refund()))).status).toBe(204);
    expect(mocks.recordTestPayment.mock.lastCall?.[1]).toEqual({
      ...payment,
      status: "revoked",
    });
    mocks.recordedWebhook.mockResolvedValueOnce(true);
    expect((await razorpayWebhook(webhook(refund()))).status).toBe(204);
    expect(mocks.fetchGatewayPayment).toHaveBeenCalledTimes(2);
  });

  it("rejects an unsigned notification and a mismatched refund payment before applying a hold", async () => {
    expect((await razorpayWebhook(webhook(refund(), "invalid"))).status).toBe(
      401,
    );
    expect(
      (await razorpayWebhook(webhook(refund("refund.processed", "pay_Other"))))
        .status,
    ).toBe(400);
    expect(mocks.recordTestPayment).not.toHaveBeenCalled();
    expect(mocks.fetchGatewayPayment).not.toHaveBeenCalled();
  });

  it("does not acknowledge a recoverable atomic event failure", async () => {
    mocks.recordTestPayment
      .mockResolvedValueOnce("retry")
      .mockResolvedValueOnce("verified");
    expect((await razorpayWebhook(webhook(raw))).status).toBe(503);
    expect((await razorpayWebhook(webhook(raw))).status).toBe(204);
    expect(mocks.fetchGatewayPayment).toHaveBeenCalledTimes(2);
  });

  it("revalidates a processed legacy event without an order outcome", async () => {
    const { recordedWebhook } =
      await vi.importActual<typeof import("./store")>("./store");
    const select = vi.fn();
    const filter = { select, or: vi.fn(), not: vi.fn(), limit: vi.fn() };
    filter.select.mockReturnValue(filter);
    filter.or.mockReturnValue(filter);
    filter.not.mockReturnValue(filter);
    filter.limit.mockResolvedValue({
      data: [{ outcome: "legacy_unbound" }],
      error: null,
    });
    mocks.createServiceClient.mockReturnValue({ from: () => filter });
    mocks.recordedWebhook.mockImplementation(recordedWebhook);
    expect((await razorpayWebhook(webhook(raw))).status).toBe(204);
    expect(select).toHaveBeenCalledWith("outcome");
    expect(mocks.fetchGatewayPayment).toHaveBeenCalledWith(payment.id);
    expect(mocks.recordTestPayment).toHaveBeenCalledTimes(1);
  });
});
