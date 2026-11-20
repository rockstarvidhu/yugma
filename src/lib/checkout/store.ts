import "server-only";
import { z } from "zod";
import type { getServerAuth } from "@/lib/auth/server";
import type { createServiceClient } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import { CHECKOUT_CURRENCY } from "./contract";

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
  }),
});

export async function loadAfterglowCheckoutDraft(
  { client, ownerId }: ScopedReader,
  draftId: string,
) {
  const { data, error } = await client
    .from("invitations")
    .select(
      "template_id,template:templates!invitations_template_id_fkey(registry_key,draft_eligible)",
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
    !draft.template.draft_eligible
  )
    return null;
  return { id: draftId, templateId: draft.template_id };
}

const orderColumns =
  "id,gateway_order_id,gateway_payment_id,amount_paise,currency,status";
const testOrderSchema = z.object({
  id: draftIdSchema,
  gateway_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  gateway_payment_id: z.string().nullable(),
  amount_paise: z.number().int().min(100),
  currency: z.literal(CHECKOUT_CURRENCY),
  status: z.enum(["test_created", "test_verified"]),
});

export async function findTestOrder(
  db: ServiceClient,
  ownerId: string,
  match: { draftId: string } | { gatewayOrderId: string },
) {
  const query = db
    .from("orders")
    .select(orderColumns)
    .eq("owner_id", ownerId)
    .in("status", ["test_created", "test_verified"]);
  const { data, error } = await (
    "draftId" in match
      ? query.eq("invitation_id", match.draftId)
      : query.eq("gateway_order_id", match.gatewayOrderId)
  ).maybeSingle();
  if (error) throw error;
  return data ? testOrderSchema.parse(data) : null;
}

export async function insertTestOrder(
  db: ServiceClient,
  ownerId: string,
  draft: { id: string; templateId: string },
  gatewayOrderId: string,
  amount: number,
) {
  const { data, error } = await db
    .from("orders")
    .insert({
      owner_id: ownerId,
      invitation_id: draft.id,
      template_id: draft.templateId,
      gateway_order_id: gatewayOrderId,
      amount_paise: amount,
      currency: CHECKOUT_CURRENCY,
      status: "test_created",
    })
    .select(orderColumns)
    .single();
  if (error?.code === "23505") {
    const existing = await findTestOrder(db, ownerId, { draftId: draft.id });
    if (existing) return existing;
  }
  if (error) throw error;
  return testOrderSchema.parse(data);
}

export async function recordTestPayment(
  db: ServiceClient,
  ownerId: string,
  order: z.output<typeof testOrderSchema>,
  paymentId: string,
) {
  const { data, error } = await db
    .from("orders")
    .update({
      status: "test_verified",
      gateway_payment_id: paymentId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("owner_id", ownerId)
    .eq("status", "test_created")
    .select(orderColumns)
    .maybeSingle();
  if (error) throw error;
  const saved = data
    ? testOrderSchema.parse(data)
    : await findTestOrder(db, ownerId, {
        gatewayOrderId: order.gateway_order_id,
      });
  return (
    saved?.status === "test_verified" && saved.gateway_payment_id === paymentId
  );
}
