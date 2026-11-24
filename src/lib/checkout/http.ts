import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getVerifiedSession } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import { parseJson, readJsonBodyBytes } from "@/lib/http-json";
import type { CheckoutOrder, CheckoutState } from "./contract";
import { getTestGateway, matchesHmac, matchesSignature } from "./gateway";
import {
  attachGatewayTestOrder,
  authorizeTestCheckout,
  checkoutState,
  claimTestReconciliation,
  findTestOrder,
  loadAfterglowCheckoutDraft,
  recordTestPayment,
  recordedWebhook,
  reserveTestOrder,
  type TestOrder,
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
const paymentIdentity = z.object({
  id: paymentId,
  order_id: orderId.nullable(),
  amount: z.number().int().positive().max(2_147_483_647),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
const eventPayment = paymentIdentity.extend({
  status: z.enum(["authorized", "captured", "failed"]),
});
// Webhook entities are snapshots. Only these fields from the live provider response
// can reach the transactional fulfilment path.
const providerPayment = eventPayment.extend({
  status: z.enum([
    "created",
    "authorized",
    "captured",
    "refunded",
    "failed",
    "cancelled",
  ]),
  captured: z.boolean(),
  amount_refunded: z.number().int().nonnegative(),
  refund_status: z.enum(["partial", "full"]).nullish(),
});
const orderPayments = z.object({ items: z.array(z.unknown()).max(100) });
type ProviderPayment = z.output<typeof providerPayment>;

function matchedPayment(input: unknown, order: TestOrder, expectedId?: string) {
  const result = providerPayment.safeParse(input);
  if (!result.success) return null;
  const payment = result.data;
  return (expectedId === undefined || payment.id === expectedId) &&
    payment.order_id === order.gateway_order_id &&
    payment.amount === order.amount_paise &&
    payment.currency === order.currency
    ? payment
    : null;
}

function paymentEvidence({
  id,
  order_id,
  amount,
  currency,
  ...payment
}: ProviderPayment) {
  const status =
    payment.amount_refunded === amount &&
    (payment.refund_status == null || payment.refund_status === "full") &&
    (payment.captured || payment.status === "refunded")
      ? "revoked"
      : payment.amount_refunded > 0 ||
          payment.refund_status ||
          payment.status === "refunded"
        ? "suspended"
        : payment.status === "captured" && payment.captured
          ? "captured"
          : !payment.captured &&
              (payment.status === "authorized" ||
                payment.status === "failed" ||
                payment.status === "cancelled")
            ? payment.status === "authorized"
              ? "authorized"
              : "failed"
            : "ignored";
  return { id, order_id, amount, currency, status } as const;
}

const webhookInput = z.object({
  event: z.enum([
    "payment.authorized",
    "payment.captured",
    "payment.failed",
    "order.paid",
  ]),
  payload: z.object({ payment: z.object({ entity: eventPayment }) }),
});
const refundEntity = z.object({
  entity: z.object({
    id: z
      .string()
      .max(80)
      .regex(/^rfnd_[A-Za-z0-9]+$/),
    payment_id: paymentId,
    status: z.enum(["pending", "processed", "failed"]),
  }),
});
const disputeEntity = z.object({
  entity: z.object({
    id: z
      .string()
      .max(80)
      .regex(/^disp_[A-Za-z0-9]+$/),
    payment_id: paymentId,
  }),
});
const financialWebhook = z.union([
  z.object({
    event: z.enum(["refund.created", "refund.processed", "refund.failed"]),
    payload: z.object({
      payment: z.object({ entity: paymentIdentity }),
      refund: refundEntity,
    }),
  }),
  z.object({
    event: z.enum([
      "payment.dispute.created",
      "payment.dispute.under_review",
      "payment.dispute.action_required",
      "payment.dispute.lost",
      "payment.dispute.won",
      "payment.dispute.closed",
    ]),
    payload: z.object({
      payment: z.object({ entity: paymentIdentity }),
      dispute: disputeEntity,
    }),
  }),
]);
type Session = NonNullable<Awaited<ReturnType<typeof getVerifiedSession>>>;
type ServiceClient = ReturnType<typeof createServiceClient>;

function respond(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function failure(status: number, error: string) {
  return respond({ error }, status);
}

function isCheckoutState(state: string): state is CheckoutState {
  return [
    "pending",
    "verified",
    "processing",
    "failed",
    "suspended",
    "revoked",
  ].includes(state);
}

async function getOrderEvidence(order: TestOrder) {
  const result = orderPayments.parse(
    await getTestGateway().fetchOrderPayments(order.gateway_order_id),
  );
  return result.items.map((item) => {
    const payment = matchedPayment(item, order);
    return payment ? paymentEvidence(payment) : null;
  });
}

function bestEvidence(
  evidence: Awaited<ReturnType<typeof getOrderEvidence>>,
  order: TestOrder,
) {
  return (
    evidence.find((item) => item?.status === "revoked") ??
    evidence.find((item) => item?.status === "suspended") ??
    evidence.find((item) => item?.status === "captured") ??
    evidence.find((item) => item?.status === "authorized") ??
    evidence.find(
      (item) =>
        item?.id === order.gateway_payment_id && item.status === "failed",
    ) ??
    evidence.find((item) => item?.status === "failed")
  );
}

async function checkRetry(
  db: ServiceClient,
  ownerId: string,
  order: TestOrder,
) {
  const current = checkoutState(order);
  if (current !== "pending" && current !== "failed") return current;

  const checkedAt = new Date().toISOString();
  const evidence = await getOrderEvidence(order);
  const candidate = bestEvidence(evidence, order);
  if (candidate && candidate.status !== "failed") {
    const state =
      candidate.status === "authorized"
        ? await recordTestPayment(db, candidate, { ownerId }, checkedAt)
        : await recordTestPayment(db, candidate, { ownerId });
    return isCheckoutState(state) ? state : "processing";
  }
  if (evidence.some((item) => item?.status !== "failed")) return "processing";
  if (
    current === "failed" &&
    !evidence.some((item) => item?.id === order.gateway_payment_id)
  )
    return "processing";
  if (
    current === "pending" &&
    candidate &&
    (await recordTestPayment(db, candidate, { ownerId }, checkedAt)) !==
      "failed"
  )
    return "processing";
  return (await authorizeTestCheckout(
    db,
    ownerId,
    order.id,
    candidate?.id ?? null,
  ))
    ? "pending"
    : "processing";
}

async function withCheckout<T>(
  request: Request,
  schema: z.ZodType<T>,
  operation: (session: Session, input: T) => Promise<Response>,
) {
  try {
    const session = await getVerifiedSession();
    if (!session) return failure(401, "Sign in to use checkout.");
    const input = schema.safeParse(
      parseJson(await readJsonBodyBytes(request, 4096)),
    );
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
    const { orders } = getTestGateway();
    const db = createServiceClient();
    let order = await findTestOrder(db, session.ownerId, { draftId });
    if (!order) {
      const reservation = await reserveTestOrder(db, session.ownerId, draftId);
      if (reservation) {
        const receipt = `test_${reservation.id.replaceAll("-", "")}`;
        const previousOrders = reservation.recovering
          ? await orders.all({ receipt, count: 10 })
          : null;
        const recovered = previousOrders?.items.find(
          (item) => item.receipt === receipt,
        );
        const created =
          recovered ??
          (await orders.create({
            amount: reservation.amount_paise,
            currency: reservation.currency,
            receipt,
            partial_payment: false,
          }));
        if (
          Number(created.amount) !== reservation.amount_paise ||
          created.currency !== reservation.currency ||
          created.receipt !== receipt
        )
          throw new Error("Razorpay returned different order details");
        order = await attachGatewayTestOrder(
          db,
          session.ownerId,
          reservation,
          orderId.parse(created.id),
        );
      }
      order ??= await findTestOrder(db, session.ownerId, { draftId });
      if (!order)
        return failure(
          503,
          "Checkout is still preparing your order. Try again shortly.",
        );
    }
    const state = await checkRetry(db, session.ownerId, order).catch(
      () => "processing" as const,
    );
    if (state !== "pending") return respond({ state }, 409);
    return respond({
      order_id: order.gateway_order_id,
      amount: order.amount_paise,
      currency: order.currency,
    } satisfies CheckoutOrder);
  });
}

export function verifyPayment(request: Request) {
  return withCheckout(request, signatureInput, async ({ ownerId }, input) => {
    const { fetchPayment, keySecret } = getTestGateway();
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

    if (
      order.status === "test_verified" &&
      order.gateway_payment_id !== paymentId
    )
      return failure(400, "This order has a different verified payment.");

    const checkedAt = new Date().toISOString();
    const payment = matchedPayment(
      await fetchPayment(paymentId),
      order,
      paymentId,
    );
    if (!payment)
      return failure(400, "Payment details do not match this order.");
    const evidence = paymentEvidence(payment);
    if (evidence.status === "ignored")
      return respond({ state: "processing" }, 409);
    const state =
      evidence.status === "authorized" || evidence.status === "failed"
        ? await recordTestPayment(db, evidence, { ownerId }, checkedAt)
        : await recordTestPayment(db, evidence, { ownerId });
    if (state === "verified") return respond({ success: true });
    if (state === "failed") return respond({ state });
    if (isCheckoutState(state)) return respond({ state }, 409);
    return failure(409, "Checkout changed. Check your payment status.");
  });
}

export async function getCheckoutStatus(draftId: string) {
  try {
    const session = await getVerifiedSession();
    if (!session) return failure(401, "Sign in to use checkout.");
    if (!draftIdSchema.safeParse(draftId).success)
      return failure(404, "Draft unavailable for checkout.");
    const db = createServiceClient();
    const order = await findTestOrder(db, session.ownerId, { draftId });
    if (!order && !(await loadAfterglowCheckoutDraft(session, draftId)))
      return failure(404, "Draft unavailable for checkout.");
    const current = checkoutState(order);
    if (!order || current === "revoked") return respond({ state: current });

    if (!(await claimTestReconciliation(db, session.ownerId, order.id)))
      return respond({ state: current });

    try {
      if (order.status === "test_verified" && order.gateway_payment_id) {
        const payment = matchedPayment(
          await getTestGateway().fetchPayment(order.gateway_payment_id),
          order,
          order.gateway_payment_id,
        );
        if (payment) {
          const state = await recordTestPayment(db, paymentEvidence(payment), {
            ownerId: session.ownerId,
          });
          if (isCheckoutState(state)) return respond({ state });
        }
        return respond({ state: current });
      }
      const checkedAt = new Date().toISOString();
      const evidence = await getOrderEvidence(order);
      const candidate = bestEvidence(evidence, order);
      if (candidate) {
        const source = { ownerId: session.ownerId };
        const state =
          candidate.status === "authorized" || candidate.status === "failed"
            ? await recordTestPayment(db, candidate, source, checkedAt)
            : await recordTestPayment(db, candidate, source);
        if (isCheckoutState(state)) return respond({ state });
      }
    } catch {
      // A provider timeout must never unlock anything or erase the saved order state.
    }
    return respond({ state: current });
  } catch {
    return failure(500, "Couldn’t check payment status. Try again.");
  }
}

export async function razorpayWebhook(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || secret === process.env.RAZORPAY_KEY_SECRET)
    return failure(503, "Webhook unavailable.");
  try {
    const body = await readJsonBodyBytes(request, 256 * 1024);
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    if (!body || !matchesHmac(body, signature, secret))
      return failure(401, "Invalid webhook signature.");
    const eventId = request.headers.get("x-razorpay-event-id") ?? "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(eventId))
      return failure(400, "Invalid webhook event ID.");
    const payload = parseJson(body);
    const financial = financialWebhook.safeParse(payload);
    const input = webhookInput.safeParse(payload);
    if (financial.success) {
      return await handleFinancialWebhook(
        financial.data,
        eventId,
        createHash("sha256").update(body).digest("hex"),
      );
    }
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
    const db = createServiceClient();
    const digest = createHash("sha256").update(body).digest("hex");
    const source = { eventId, digest };
    const acknowledged = () => new Response(null, { status: 204 });
    if (await recordedWebhook(db, eventId, digest)) return acknowledged();
    if (!entity.order_id) {
      await recordTestPayment(db, { ...entity, status: "ignored" }, source);
      return acknowledged();
    }
    const order = await findTestOrder(db, null, {
      gatewayOrderId: entity.order_id,
    });
    if (!order)
      return failure(
        503,
        "Checkout order matching is pending. Retry delivery.",
      );
    if (
      entity.amount !== order.amount_paise ||
      entity.currency !== order.currency
    ) {
      await recordTestPayment(db, { ...entity, status: "ignored" }, source);
      return acknowledged();
    }

    const checkedAt = new Date().toISOString();
    const payment = matchedPayment(
      providerPayment.parse(await getTestGateway().fetchPayment(entity.id)),
      order,
      entity.id,
    );
    const evidence = payment ? paymentEvidence(payment) : null;
    if (
      evidence &&
      entity.status === "captured" &&
      evidence.status !== "captured" &&
      payment?.status !== "refunded" &&
      !payment?.amount_refunded &&
      !payment?.refund_status
    ) {
      return failure(503, "Provider capture is pending. Retry delivery.");
    }
    const saved =
      evidence?.status === "authorized" || evidence?.status === "failed"
        ? await recordTestPayment(db, evidence, source, checkedAt)
        : await recordTestPayment(
            db,
            evidence ?? { ...entity, status: "ignored" },
            source,
          );
    return saved === "retry"
      ? failure(503, "Checkout order matching is pending. Retry delivery.")
      : acknowledged();
  } catch {
    return failure(503, "Couldn’t process the webhook. Retry delivery.");
  }
}

async function handleFinancialWebhook(
  input: z.output<typeof financialWebhook>,
  eventId: string,
  digest: string,
) {
  const { entity } = input.payload.payment;
  const reference =
    "refund" in input.payload ? input.payload.refund : input.payload.dispute;
  if (reference.entity.payment_id !== entity.id)
    return failure(400, "Invalid webhook payment reference.");
  if (
    input.event === "refund.processed" &&
    input.payload.refund.entity.status !== "processed"
  )
    return failure(400, "Invalid webhook refund status.");
  const db = createServiceClient();
  if (await recordedWebhook(db, eventId, digest))
    return new Response(null, { status: 204 });
  if (!entity.order_id) return new Response(null, { status: 204 });
  const order = await findTestOrder(db, null, {
    gatewayOrderId: entity.order_id,
  });
  if (!order)
    return failure(503, "Checkout order matching is pending. Retry delivery.");
  if (
    entity.amount !== order.amount_paise ||
    entity.currency !== order.currency ||
    (order.status === "test_verified" && order.gateway_payment_id !== entity.id)
  )
    return failure(400, "Webhook does not match the checkout payment.");

  const source = { eventId, digest };
  // Only authenticated, order-bound notifications may apply this temporary hold.
  // Leave the event retryable until a provider read completes.
  const held = await recordTestPayment(
    db,
    { ...entity, status: "pending_review" },
    source,
  );
  if (held === "duplicate") return new Response(null, { status: 204 });
  if (held !== "awaiting_verification")
    return failure(503, "Checkout order matching is pending. Retry delivery.");
  const payment = matchedPayment(
    await getTestGateway().fetchPayment(entity.id),
    order,
    entity.id,
  );
  if (!payment)
    return failure(
      503,
      "Provider payment verification is pending. Retry delivery.",
    );
  const evidence = paymentEvidence(payment);
  if (
    input.event === "refund.processed" &&
    evidence.status !== "revoked" &&
    evidence.status !== "suspended"
  )
    return failure(
      503,
      "Provider refund verification is pending. Retry delivery.",
    );
  const saved = await recordTestPayment(
    db,
    {
      ...evidence,
      status: evidence.status === "revoked" ? "revoked" : "suspended",
    },
    source,
  );
  return saved === "retry"
    ? failure(503, "Checkout order matching is pending. Retry delivery.")
    : new Response(null, { status: 204 });
}
