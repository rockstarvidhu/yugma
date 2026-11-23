import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioEditor } from "@/components/studio/StudioEditor";
import { StudioShell } from "@/components/studio/StudioShell";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { canCreatePrivateDraft } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import { loadDraft } from "@/lib/drafts/store";
import { privateMediaConfigured } from "@/lib/media/storage";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";

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

  const templateName =
    getStorefrontCatalogue().find(
      ({ templateId }) => templateId === draft.templateKey,
    )?.name ?? "invitation";

  return (
    <StudioEditor
      key={draft.id}
      initialDraft={draft}
      templateName={templateName}
      mediaAvailable={privateMediaConfigured() && canCreatePrivateDraft()}
      checkoutUrl={
        draft.templateKey === "afterglow" ? `/checkout/${id}` : undefined
      }
    />
  );
}
