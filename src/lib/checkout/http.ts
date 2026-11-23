import "server-only";
import { z } from "zod";
import { getVerifiedSession } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import type { CheckoutOrder } from "./contract";
import { getTestGateway, matchesHmac, matchesSignature } from "./gateway";
import {
  checkoutState,
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
const paymentId = z
  .string()
  .max(80)
  .regex(/^pay_[A-Za-z0-9]+$/);
const signatureInput = z.strictObject({
  razorpay_payment_id: paymentId,
  razorpay_order_id: orderId,
  razorpay_signature: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/i),
});
const eventPayment = z.object({
  id: paymentId,
  order_id: orderId.nullable(),
  amount: z.number().int().positive().max(2_147_483_647),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(["authorized", "captured", "failed"]),
});
const webhookInput = z.object({
  event: z.enum(["payment.captured", "payment.failed", "order.paid"]),
  payload: z.object({ payment: z.object({ entity: eventPayment }) }),
});
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

async function readBody(request: Request, maxBytes: number) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json" || !request.body) return null;
  if (Number(request.headers.get("content-length")) > maxBytes) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, bytes);
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function parseJson(body: Uint8Array | null): unknown {
  if (!body) return null;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return null;
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
    const input = schema.safeParse(parseJson(await readBody(request, 4096)));
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
    const { sdk, keyId } = getTestGateway();
    const db = createServiceClient();
    let order = await findTestOrder(db, session.ownerId, { draftId });
    if (!order) {
      const receipt = `test_${draftId.replaceAll("-", "").toLowerCase()}`;
      const created = await sdk.orders
        .create({
          amount: draft.amount,
          currency: draft.currency,
          receipt,
          partial_payment: false,
        })
        .catch(async (error: unknown) => {
          const { items } = await sdk.orders.all({ receipt, count: 10 });
          const recovered = items.find(
            (item) =>
              item.receipt === receipt &&
              Number(item.amount) === draft.amount &&
              item.currency === draft.currency,
          );
          if (!recovered) throw error;
          return recovered;
        });
      if (
        Number(created.amount) !== draft.amount ||
        created.currency !== draft.currency
      )
        throw new Error("Razorpay returned different order details");
      order = await insertTestOrder(
        db,
        session.ownerId,
        draft,
        orderId.parse(created.id),
      );
    }
    const state = checkoutState(order);
    if (state === "verified" || state === "processing")
      return respond({ state }, 409);
    return respond({
      order_id: order.gateway_order_id,
      amount: order.amount_paise,
      currency: order.currency,
      key_id: keyId,
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
    if (
      payment.status !== "captured" &&
      payment.status !== "authorized" &&
      payment.status !== "failed"
    )
      return respond({ state: "processing" }, 202);
    const state = await recordTestPayment(
      db,
      {
        id: paymentId,
        order_id: order.gateway_order_id,
        amount: order.amount_paise,
        currency: order.currency,
        status: payment.status,
      },
      { ownerId },
    );
    if (state === "verified") return respond({ success: true });
    if (state === "failed") return respond({ state });
    if (state === "processing") return respond({ state }, 202);
    return failure(409, "Checkout changed. Check your payment status.");
  });
}

export async function getCheckoutStatus(draftId: string) {
  try {
    const session = await getVerifiedSession();
    if (!session) return failure(401, "Sign in to use checkout.");
    if (!draftIdSchema.safeParse(draftId).success)
      return failure(404, "Draft unavailable for checkout.");
    const draft = await loadAfterglowCheckoutDraft(session, draftId);
    if (!draft) return failure(404, "Draft unavailable for checkout.");
    const order = await findTestOrder(createServiceClient(), session.ownerId, {
      draftId,
    });
    return respond({ state: checkoutState(order) });
  } catch {
    return failure(500, "Couldn’t check payment status. Try again.");
  }
}

export async function razorpayWebhook(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || secret === process.env.RAZORPAY_KEY_SECRET)
    return failure(503, "Webhook unavailable.");
  try {
    const body = await readBody(request, 256 * 1024);
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    if (!body || !matchesHmac(body, signature, secret))
      return failure(401, "Invalid webhook signature.");
    const eventId = request.headers.get("x-razorpay-event-id") ?? "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(eventId))
      return failure(400, "Invalid webhook event ID.");
    const input = webhookInput.safeParse(parseJson(body));
    if (!input.success) return failure(400, "Invalid webhook event.");
    const {
      event,
      payload: {
        payment: { entity },
      },
    } = input.data;
    const expectedEvent = `payment.${entity.status}`;
    if (
      event !== expectedEvent &&
      !(event === "order.paid" && entity.status === "captured")
    )
      return failure(400, "Invalid webhook payment status.");
    await recordTestPayment(createServiceClient(), entity, { eventId });
    return new Response(null, { status: 204 });
  } catch {
    return failure(503, "Couldn’t process the webhook. Retry delivery.");
  }
}
