import "server-only";
import { z } from "zod";
import type { getServerAuth } from "@/lib/auth/server";
import type { createServiceClient } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import { CHECKOUT_CURRENCY, type CheckoutState } from "./contract";

type ScopedReader = {
  client: NonNullable<Awaited<ReturnType<typeof getServerAuth>>>;
  ownerId: string;
};
type ServiceClient = ReturnType<typeof createServiceClient>;

const draftForCheckoutSchema = z.object({
  template_id: draftIdSchema,
  template: z.object({
    registry_key: z.string(),
    draft_eligible: z.boolean(),
    status: z.string(),
    price_in_paise: z.number().int().positive().nullable(),
    currency: z.literal(CHECKOUT_CURRENCY),
  }),
});

export async function loadAfterglowCheckoutDraft(
  { client, ownerId }: ScopedReader,
  draftId: string,
) {
  const { data, error } = await client
    .from("invitations")
    .select(
      "template_id,template:templates!invitations_template_id_fkey(registry_key,draft_eligible,status,price_in_paise,currency)",
    )
    .eq("id", draftId)
    .eq("owner_id", ownerId)
    .eq("status", "draft")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const draft = draftForCheckoutSchema.parse(data);
  if (
    draft.template.registry_key !== "afterglow" ||
    !draft.template.draft_eligible ||
    draft.template.status !== "active" ||
    draft.template.price_in_paise === null ||
    draft.template.price_in_paise < 100
  )
    return null;
  return {
    id: draftId,
    templateId: draft.template_id,
    amount: draft.template.price_in_paise,
    currency: draft.template.currency,
  };
}

const orderColumns =
  "id,gateway_order_id,gateway_payment_id,amount_paise,currency,status,test_entitlement";
const states = {
  test_created: "pending",
  test_failed: "failed",
  test_processing: "processing",
  test_verified: "verified",
} as const satisfies Record<string, CheckoutState>;

const orderStatus = z.enum(Object.keys(states) as (keyof typeof states)[]);
const testOrderSchema = z.object({
  id: draftIdSchema,
  gateway_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  gateway_payment_id: z.string().nullable(),
  amount_paise: z.number().int().min(100),
  currency: z.literal(CHECKOUT_CURRENCY),
  status: orderStatus,
  test_entitlement: z
    .enum(["unconfirmed", "active", "suspended", "revoked"])
    .nullable(),
});

export function checkoutState(
  order: z.output<typeof testOrderSchema> | null,
): CheckoutState {
  if (!order) return "ready";
  if (order.test_entitlement === "revoked") return "revoked";
  if (
    order.test_entitlement === "suspended" ||
    (order.status === "test_verified" && order.test_entitlement !== "active")
  )
    return "suspended";
  return states[order.status];
}

export type TestOrder = z.output<typeof testOrderSchema>;

export async function findTestOrder(
  db: ServiceClient,
  ownerId: string | null,
  match: { draftId: string } | { gatewayOrderId: string },
) {
  if (ownerId === null && "draftId" in match) return null;
  const query = db
    .from("orders")
    .select(orderColumns)
    .in("status", orderStatus.options);
  if (ownerId !== null) query.eq("owner_id", ownerId);
  const { data, error } = await (
    "draftId" in match
      ? query.eq("invitation_id", match.draftId)
      : query.eq("gateway_order_id", match.gatewayOrderId)
  ).maybeSingle();
  if (error) throw error;
  return data ? testOrderSchema.parse(data) : null;
}

export async function recordedWebhook(
  db: ServiceClient,
  eventId: string,
  digest: string,
) {
  const { data, error } = await db
    .from("payment_events")
    .select("outcome")
    .or("gateway_event_id.eq." + eventId + ",request_sha256.eq." + digest)
    .not("processed_at", "is", null)
    .limit(2);
  if (error) throw error;
  return z
    .array(z.object({ outcome: z.string().nullable() }))
    .parse(data)
    .some(({ outcome }) => outcome !== "legacy_unbound");
}

export async function claimTestReconciliation(
  db: ServiceClient,
  ownerId: string,
  orderId: string,
) {
  const { data, error } = await db.rpc("claim_razorpay_test_reconciliation", {
    p_owner_id: ownerId,
    p_id: orderId,
  });
  if (error) throw error;
  return z.boolean().parse(data);
}

export async function authorizeTestCheckout(
  db: ServiceClient,
  ownerId: string,
  orderId: string,
  paymentId: string | null,
) {
  const { data, error } = await db.rpc("authorize_razorpay_test_checkout", {
    p_owner_id: ownerId,
    p_id: orderId,
    p_expected_payment_id: paymentId,
  });
  if (error) throw error;
  return z.boolean().parse(data);
}

const reservationSchema = z.object({
  id: draftIdSchema,
  amount_paise: z.number().int().min(100),
  currency: z.literal(CHECKOUT_CURRENCY),
  reservation_token: draftIdSchema,
  recovering: z.boolean(),
});

export async function reserveTestOrder(
  db: ServiceClient,
  ownerId: string,
  draftId: string,
) {
  const { data, error } = await db
    .rpc("reserve_razorpay_test_order", {
      p_owner_id: ownerId,
      p_invitation_id: draftId,
    })
    .maybeSingle();
  if (error) throw error;
  return data ? reservationSchema.parse(data) : null;
}

export async function attachGatewayTestOrder(
  db: ServiceClient,
  ownerId: string,
  reservation: z.output<typeof reservationSchema>,
  gatewayOrderId: string,
) {
  const { data, error } = await db
    .from("orders")
    .update({
      gateway_order_id: gatewayOrderId,
      status: "test_created",
      reservation_token: null,
      reservation_expires_at: null,
    })
    .eq("id", reservation.id)
    .eq("owner_id", ownerId)
    .eq("status", "test_reserving")
    .eq("reservation_token", reservation.reservation_token)
    .select(orderColumns)
    .maybeSingle();
  if (error) throw error;
  return data ? testOrderSchema.parse(data) : null;
}

export async function recordTestPayment(
  db: ServiceClient,
  payment: {
    id: string;
    order_id: string | null;
    amount: number;
    currency: string;
    status:
      | "authorized"
      | "captured"
      | "failed"
      | "ignored"
      | "suspended"
      | "revoked"
      | "pending_review";
  },
  source: { ownerId: string } | { eventId: string; digest: string },
  checkedAt?: string,
) {
  const { data, error } = await db.rpc("record_razorpay_test_payment", {
    p_order_id: payment.order_id,
    p_payment_id: payment.id,
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_status: payment.status,
    p_owner_id: "ownerId" in source ? source.ownerId : null,
    p_event_id: "eventId" in source ? source.eventId : null,
    p_request_sha256: "digest" in source ? source.digest : null,
    p_checked_at: checkedAt ?? null,
  });
  if (error) throw error;
  return z
    .enum([
      "failed",
      "processing",
      "verified",
      "ignored",
      "duplicate",
      "suspended",
      "revoked",
      "awaiting_verification",
      "retry",
    ])
    .parse(data);
}
