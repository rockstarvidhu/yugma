import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getVerifiedSession } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import {
  AFTERGLOW_PRICE_PAISE,
  CHECKOUT_CURRENCY,
  type CheckoutOrder,
} from "./contract";
import { getTestGateway, matchesSignature } from "./gateway";
import {
  findTestOrder,
  insertTestOrder,
  loadAfterglowCheckoutDraft,
  recordTestPayment,
} from "./store";

const orderInput = z.strictObject({ draftId: draftIdSchema });
const orderId = z
  .string()
  .max(80)
  .regex(/^order_[A-Za-z0-9]+$/);
const signatureInput = z.strictObject({
  razorpay_payment_id: z
    .string()
    .max(80)
    .regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_order_id: orderId,
  razorpay_signature: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/i),
});
const purchaseAmount = z.number().int().min(100);
type Session = NonNullable<Awaited<ReturnType<typeof getVerifiedSession>>>;

function respond(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failure(status: number, error: string) {
  return respond({ error }, status);
}

async function checkoutJson(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json" || !request.body) return null;
  const maxBytes = 4096;
  if (Number(request.headers.get("content-length")) > maxBytes) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

async function withCheckout<T>(
  request: Request,
  schema: z.ZodType<T>,
  operation: (session: Session, input: T) => Promise<Response>,
) {
  try {
    const session = await getVerifiedSession();
    if (!session) return failure(401, "Sign in to use checkout.");
    const input = schema.safeParse(await checkoutJson(request));
    if (!input.success) return failure(400, "The checkout request is invalid.");
    return await operation(session, input.data);
  } catch {
    return failure(500, "Checkout is temporarily unavailable. Try again.");
  }
}

export function createOrder(request: Request) {
  return withCheckout(request, orderInput, async (session, { draftId }) => {
    const draft = await loadAfterglowCheckoutDraft(session, draftId);
    if (!draft) return failure(404, "Draft unavailable for checkout.");
    const { sdk } = getTestGateway();
    const db = createServiceClient();
    let order = await findTestOrder(db, session.ownerId, { draftId });
    const amount = purchaseAmount.parse(AFTERGLOW_PRICE_PAISE);
    if (!order) {
      const receipt = `test_${randomUUID().replaceAll("-", "")}`;
      const created = await sdk.orders.create({
        amount,
        currency: CHECKOUT_CURRENCY,
        receipt,
        partial_payment: false,
      });
      if (
        Number(created.amount) !== amount ||
        created.currency !== CHECKOUT_CURRENCY
      )
        throw new Error("Razorpay returned different order details");
      order = await insertTestOrder(
        db,
        session.ownerId,
        draft,
        orderId.parse(created.id),
        amount,
      );
    }
    if (order.status === "test_verified")
      return failure(409, "This draft already has a verified test payment.");
    return respond({
      order_id: order.gateway_order_id,
      amount: order.amount_paise,
      currency: order.currency,
    } satisfies CheckoutOrder);
  });
}

export function verifyPayment(request: Request) {
  return withCheckout(request, signatureInput, async ({ ownerId }, input) => {
    const { sdk, keySecret } = getTestGateway();
    const db = createServiceClient();
    const order = await findTestOrder(db, ownerId, {
      gatewayOrderId: input.razorpay_order_id,
    });
    if (!order) return failure(404, "Checkout order unavailable.");
    const paymentId = input.razorpay_payment_id;
    if (
      !matchesSignature(
        order.gateway_order_id,
        paymentId,
        input.razorpay_signature,
        keySecret,
      )
    )
      return failure(400, "Payment signature verification failed.");

    if (order.status === "test_verified")
      return order.gateway_payment_id === paymentId
        ? respond({ success: true })
        : failure(400, "This order has a different verified payment.");

    const payment = await sdk.payments.fetch(paymentId);
    if (
      payment.id !== paymentId ||
      payment.order_id !== order.gateway_order_id ||
      Number(payment.amount) !== order.amount_paise ||
      payment.currency !== order.currency
    ) {
      return failure(400, "Payment details do not match this order.");
    }
    if (payment.status !== "captured")
      return failure(
        409,
        "The test payment has not been captured. Try verifying again.",
      );
    const saved = await recordTestPayment(db, ownerId, order, paymentId);
    return saved
      ? respond({ success: true })
      : failure(409, "Checkout changed. Reload and try again.");
  });
}
