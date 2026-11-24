import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { storefrontPhotoReviewEnabled } from "@/lib/home-hero-assets";
import { invitationPath } from "@/lib/publish/contract";
import "./ready.css";
import { StudioShell } from "@/components/studio/StudioShell";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/auth/service";
import { findTestOrder } from "@/lib/checkout/store";
import { draftIdSchema } from "@/lib/drafts/contract";
import { loadDraft } from "@/lib/drafts/store";
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
  if (publication)
    return (
      <main
        className="ready-page"
        data-art={storefrontPhotoReviewEnabled() ? "review" : "brand"}
      >
        <div className="ready-content">
          <BrandLogo
            variant="emblem"
            tone="sand"
            decorative
            className="ready-mark"
          />
          <h1>Your invitation is ready.</h1>
          <p>{publication.test_publication_title}</p>
          <a
            className="ready-view"
            href={invitationPath(publication.share_slug)}
          >
            View My Invitation <span aria-hidden="true">→</span>
          </a>
          <Link className="ready-manage" href="/studio">
            Manage Invitation
          </Link>
          <ShareInvitation
            slug={publication.share_slug}
            title={publication.test_publication_title}
          />
        </div>
      </main>
    );
  if (!draft || draft.templateKey !== "afterglow") notFound();

  const order = await Promise.resolve()
    .then(() => findTestOrder(createServiceClient(), user.id, { draftId: id }))
    .then((saved) => ({ saved }))
    .catch(() => null);
  const verified = order?.saved?.status === "test_verified";
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
              {order
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
