import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/studio/StudioShell";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/auth/service";
import { getCheckoutStatus } from "@/lib/checkout/http";
import { checkoutState, findTestOrder } from "@/lib/checkout/store";
import { draftIdSchema } from "@/lib/drafts/contract";
import { loadDraft, loadOwnedPublishedInvitation } from "@/lib/drafts/store";
import { invitationSchema } from "@/lib/invitation-schema";
import { invitationTitle, publishPath } from "@/lib/publish/contract";
import {
  loadOwnerPublication,
  stagingPublishingEnabled,
  suggestSlug,
} from "@/lib/publish/store";
import { PublishForm } from "./PublishForm";
import { ShareInvitation } from "./ShareInvitation";

export const metadata: Metadata = {
  title: "Publish invitation",
  robots: { index: false, follow: false },
};

export default async function PublishPage({
  params,
}: PageProps<"/publish/[id]">) {
  const { id } = await params;
  if (!stagingPublishingEnabled() || !draftIdSchema.safeParse(id).success)
    notFound();
  const user = await requireStudioUser(publishPath(id));
  const client = await getServerAuth();
  if (!client) notFound();
  const session = { client, ownerId: user.id };
  const loaded = await Promise.all([
    loadOwnerPublication(session, id),
    loadDraft(session, id),
  ]).catch(() => null);
  if (!loaded)
    return (
      <StudioShell title="Publish invitation">
        <p role="alert">
          Couldn’t load your invitation. Reload this page to try again.
        </p>
      </StudioShell>
    );

  const [publication, draft] = loaded;
  const order = await Promise.resolve()
    .then(() => findTestOrder(createServiceClient(), user.id, { draftId: id }))
    .then((saved) => ({ saved }))
    .catch(() => null);
  let state = checkoutState(order?.saved ?? null);
  if (publication && order?.saved?.test_entitlement === "unconfirmed") {
    const response = await getCheckoutStatus(id);
    if (response.ok) {
      const latest: { state?: string } = await response.json();
      if (latest.state === "verified") state = "verified";
    }
  }
  const verified = state === "verified";

  if (publication && verified)
    return (
      <StudioShell
        title="Invitation published"
        back={
          <Link className="studio-link" href="/studio">
            Back to Studio
          </Link>
        }
      >
        <ShareInvitation
          slug={publication.share_slug}
          title={publication.test_publication_title}
        />
      </StudioShell>
    );
  if (publication) {
    const saved = await loadOwnedPublishedInvitation(session, id);
    const invitation = invitationSchema.safeParse(saved?.data);
    return (
      <StudioShell title="Guest access unavailable">
        <p>
          Only you can see this invitation here. Your share link is reserved
          while guest access is disabled.
        </p>
        {invitation.success && saved && (
          <InvitationRenderer
            templateId={saved.templateKey}
            invitation={invitation.data}
            privateDraftId={id}
            embedded
          />
        )}
      </StudioShell>
    );
  }
  if (!draft || draft.templateKey !== "afterglow") notFound();

  const invitation = invitationSchema.safeParse(draft.data);
  const title = invitation.success
    ? invitationTitle(invitation.data.couple)
    : "";
  const edit = (
    <Link className="studio-link" href={`/studio/${id}`} prefetch={false}>
      Edit draft
    </Link>
  );

  return (
    <StudioShell title="Review and publish" back={edit}>
      <section
        className="studio-panel grid gap-3"
        aria-labelledby="publication-heading"
      >
        <h2 id="publication-heading" className="font-editorial text-2xl">
          Publish your invitation
        </h2>
        {verified ? (
          <p>
            Test payment verified. You can still edit your draft before
            publishing.
          </p>
        ) : (
          <>
            <p>
              {state === "suspended" || state === "revoked"
                ? "Guest access is disabled for this test payment. Your draft is saved."
                : order
                  ? "Verify your test payment to publish this invitation."
                  : "Payment status is temporarily unavailable."}
            </p>
            <Link
              className="studio-link"
              href={`/checkout/${id}`}
              prefetch={false}
            >
              Check payment status
            </Link>
          </>
        )}
        {!invitation.success && (
          <p>
            Complete both names, the timezone and every ceremony’s details to
            publish.
          </p>
        )}
        {verified && invitation.success && (
          <PublishForm
            id={id}
            title={title}
            slug={suggestSlug(title)}
            version={draft.version}
          />
        )}
      </section>
      {invitation.success && (
        <section className="studio-panel" aria-labelledby="review-preview">
          <h2 id="review-preview" className="font-editorial text-2xl">
            Guest preview
          </h2>
          <InvitationRenderer
            templateId={draft.templateKey}
            invitation={invitation.data}
            privateDraftId={id}
            embedded
          />
        </section>
      )}
    </StudioShell>
  );
}
