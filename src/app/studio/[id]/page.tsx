import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioEditor } from "@/components/studio/StudioEditor";
import { StudioShell } from "@/components/studio/StudioShell";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { canCreatePrivateDraft, createServiceClient } from "@/lib/auth/service";
import { getRazorpayTestConfig } from "@/lib/checkout/gateway";
import {
  findTestOrder,
  loadAfterglowCheckoutDraft,
} from "@/lib/checkout/store";
import { draftIdSchema } from "@/lib/drafts/contract";
import { loadDraft } from "@/lib/drafts/store";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import { CheckoutButton } from "./CheckoutButton";

export const metadata: Metadata = {
  title: "Edit private invitation",
  robots: { index: false, follow: false },
};

export default async function DraftStudioPage({
  params,
}: PageProps<"/studio/[id]">) {
  const { id } = await params;
  if (!draftIdSchema.safeParse(id).success) notFound();
  const user = await requireStudioUser(`/studio/${id}`);
  const client = await getServerAuth();
  if (!client) notFound();
  const session = { client, ownerId: user.id };
  const result = await loadDraft(session, id)
    .then((draft) => ({ draft }))
    .catch(() => null);
  if (!result)
    return (
      <StudioShell title="Private Studio">
        <p role="alert">We couldn’t load the saved draft.</p>
        <div className="flex flex-wrap gap-4">
          <Link href={`/studio/${id}`} prefetch={false} className="studio-link">
            Retry loading
          </Link>
          <Link href="/studio" className="studio-link">
            Back to Studio
          </Link>
        </div>
      </StudioShell>
    );
  if (!result.draft) notFound();
  const draft = result.draft;

  // Preserve the existing optional Test Mode flow independently of the editor.
  const config = getRazorpayTestConfig();
  let checkout: "verified" | "available" | "unavailable" | undefined;
  if (config && canCreatePrivateDraft() && draft.templateKey === "afterglow") {
    try {
      if (await loadAfterglowCheckoutDraft(session, id)) {
        const order = await findTestOrder(createServiceClient(), user.id, {
          draftId: id,
        });
        checkout = order?.status === "test_verified" ? "verified" : "available";
      }
    } catch {
      checkout = "unavailable";
    }
  }
  const templateName =
    getStorefrontCatalogue().find(
      ({ templateId }) => templateId === draft.templateKey,
    )?.name ?? "invitation";

  return (
    <StudioEditor
      key={draft.id}
      initialDraft={draft}
      templateName={templateName}
      checkout={
        checkout && (
          <details className="studio-checkout">
            <summary>Razorpay Test Mode</summary>
            {checkout === "verified" && (
              <p role="status">Test payment verified. No money was charged.</p>
            )}
            {checkout === "available" && config && (
              <CheckoutButton draftId={id} keyId={config.keyId} />
            )}
            {checkout === "unavailable" && (
              <p>Razorpay Test Mode is temporarily unavailable.</p>
            )}
          </details>
        )
      }
    />
  );
}
