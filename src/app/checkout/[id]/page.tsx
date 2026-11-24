import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StudioShell } from "@/components/studio/StudioShell";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { canCreatePrivateDraft, createServiceClient } from "@/lib/auth/service";
import { CHECKOUT_CURRENCY } from "@/lib/checkout/contract";
import { getRazorpayTestConfig } from "@/lib/checkout/gateway";
import {
  checkoutState,
  findTestOrder,
  loadAfterglowCheckoutDraft,
} from "@/lib/checkout/store";
import { draftIdSchema } from "@/lib/drafts/contract";
import { loadDraft } from "@/lib/drafts/store";
import { publishPath } from "@/lib/publish/contract";
import {
  loadOwnerPublication,
  stagingPublishingEnabled,
} from "@/lib/publish/store";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import { CheckoutButton } from "./CheckoutButton";
import "./checkout.css";

export const metadata: Metadata = {
  title: "Invitation checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  params,
}: PageProps<"/checkout/[id]">) {
  const { id } = await params;
  if (!draftIdSchema.safeParse(id).success) notFound();
  const user = await requireStudioUser(`/checkout/${id}`);
  const client = await getServerAuth();
  if (!client) notFound();
  const session = { client, ownerId: user.id };
  const loaded = await Promise.all([
    loadDraft(session, id),
    loadAfterglowCheckoutDraft(session, id),
  ]).catch(() => null);
  const edit = (
    <Link href={`/studio/${id}`} className="studio-link" prefetch={false}>
      Edit draft
    </Link>
  );
  if (!loaded)
    return (
      <StudioShell title="Invitation checkout" back={edit}>
        <p role="alert">We couldn’t load this checkout.</p>
        <Link href={`/checkout/${id}`} className="studio-link" prefetch={false}>
          Reload checkout
        </Link>
      </StudioShell>
    );
  const [draft, eligible] = loaded;
  if (!draft) {
    if (await loadOwnerPublication(session, id)) redirect(publishPath(id));
    notFound();
  }
  const template = getStorefrontCatalogue().find(
    ({ templateId }) => templateId === draft.templateKey,
  );
  const payment = canCreatePrivateDraft()
    ? await findTestOrder(createServiceClient(), user.id, { draftId: id })
        .then((order) => ({ order }))
        .catch(() => null)
    : null;
  const keyId = eligible ? getRazorpayTestConfig()?.keyId : undefined;
  const amount = payment?.order?.amount_paise ?? eligible?.amount;
  const currency =
    payment?.order?.currency ?? eligible?.currency ?? CHECKOUT_CURRENCY;
  if (amount === undefined || !template)
    return (
      <StudioShell title="Invitation checkout" back={edit}>
        <p>This invitation is currently unavailable for test checkout.</p>
      </StudioShell>
    );
  const initialState = checkoutState(payment?.order ?? null);
  const priceFormat = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const names = [
    draft.data.couple?.partnerOne,
    draft.data.couple?.partnerTwo,
  ].filter(Boolean);
  const ceremonies = draft.data.events ?? [];
  const showPolicies = process.env.CHECKOUT_STAGING_POLICIES === "true";

  return (
    <StudioShell title="Complete your purchase" back={edit}>
      <div className="checkout-layout">
        <section
          className="studio-panel checkout-summary"
          aria-labelledby="checkout-template"
        >
          <Image
            src={template.preview.src}
            alt=""
            width={template.preview.width}
            height={template.preview.height}
            sizes="(max-width: 38rem) 80px, 112px"
          />
          <div>
            <p className="checkout-label">Invitation template</p>
            <h2 className="font-editorial" id="checkout-template">
              {template.name}
            </h2>
            <p>{template.description}</p>
          </div>
          <dl>
            <div>
              <dt>Names</dt>
              <dd>{names.join(" & ") || "To be added"}</dd>
            </div>
            <div>
              <dt>Ceremonies</dt>
              <dd>{ceremonies.length || "To be added"}</dd>
            </div>
          </dl>
        </section>
        <section
          className="studio-panel checkout-payment"
          aria-labelledby="checkout-payment"
        >
          <h2 id="checkout-payment">Order total</h2>
          <p className="font-editorial checkout-price">
            {priceFormat.format(amount / 100)}
          </p>
          <p>
            One-time test payment in INR. Use Razorpay test details. No money
            will be charged.
          </p>
          {showPolicies && (
            <nav
              aria-label="Test checkout information"
              className="checkout-policy-links"
            >
              <Link className="studio-link" href="/checkout/information#terms">
                Terms
              </Link>
              <Link
                className="studio-link"
                href="/checkout/information#refunds-delivery"
              >
                Refunds and delivery
              </Link>
              <Link
                className="studio-link"
                href="/checkout/information#privacy"
              >
                Privacy
              </Link>
              <Link
                className="studio-link"
                href="/checkout/information#support"
              >
                Support
              </Link>
            </nav>
          )}
          {payment && (keyId || payment.order) ? (
            <CheckoutButton
              key={`${id}:${initialState}:${amount}`}
              draftId={id}
              amount={amount}
              currency={currency}
              initialState={initialState}
              keyId={keyId}
              publishUrl={
                stagingPublishingEnabled() ? publishPath(id) : undefined
              }
            />
          ) : (
            <p role="status">
              Test checkout is temporarily unavailable. Your draft is saved.
            </p>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
