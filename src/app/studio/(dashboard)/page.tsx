import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StudioDraftLink } from "@/components/studio/StudioDraftLink";
import { StudioShell } from "@/components/studio/StudioShell";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { canCreatePrivateDraft } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import { listDrafts } from "@/lib/drafts/store";
import { publishPath } from "@/lib/publish/contract";
import { listOwnerPublications } from "@/lib/publish/store";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import { signOut } from "../actions";

export const metadata: Metadata = {
  title: "Your Studio",
  robots: { index: false, follow: false },
};

const updatedDate = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function StudioPage({
  searchParams,
}: PageProps<"/studio">) {
  const user = await requireStudioUser("/studio");
  const query = await searchParams;
  const client = await getServerAuth();
  const cursor = draftIdSchema.safeParse(query.after);
  const session = client && { client, ownerId: user.id };
  const [result, publications] = session
    ? await Promise.all([
        listDrafts(session, cursor.success ? cursor.data : null).catch(
          () => null,
        ),
        listOwnerPublications(session).catch(() => null),
      ])
    : [null, []];
  const catalogue = getStorefrontCatalogue();
  const firstDesign = catalogue[0];

  return (
    <StudioShell
      title="Your Studio"
      back={
        <form action={signOut}>
          <Button variant="ghost" type="submit">
            Sign out
          </Button>
        </form>
      }
    >
      <div className="studio-actions">
        <p>Create a private invitation or pick up where you left off.</p>
        {firstDesign && canCreatePrivateDraft() && (
          <Link
            href={`/create/${firstDesign.templateId}`}
            className="studio-primary-link"
          >
            Start a new invitation
          </Link>
        )}
      </div>
      {query.error === "sign-out" && (
        <p className="studio-error" role="alert">
          Couldn’t sign out. Try again.
        </p>
      )}
      <section aria-labelledby="drafts-heading" className="studio-draft-list">
        <h2 id="drafts-heading" className="font-editorial text-2xl">
          Your drafts
        </h2>
        {!result ? (
          <div className="studio-panel">
            <p role="alert" className="studio-error">
              We couldn’t load your drafts.
            </p>
            <Link href="/studio" className="studio-link" prefetch={false}>
              Reload Studio
            </Link>
          </div>
        ) : (
          <>
            {result.drafts.length === 0 ? (
              <p className="studio-panel">
                {cursor.success
                  ? "There are no more drafts on this page."
                  : "No drafts yet. Start a new invitation when you’re ready."}
              </p>
            ) : (
              <ul className="studio-draft-list" role="list">
                {result.drafts.map((draft) => {
                  const template =
                    catalogue.find(
                      ({ templateId }) => templateId === draft.templateKey,
                    )?.name ?? "Invitation";
                  const names = [
                    draft.data.couple?.partnerOne,
                    draft.data.couple?.partnerTwo,
                  ]
                    .filter(Boolean)
                    .join(" & ");
                  const title =
                    names || `Untitled ${template.toLowerCase()} invitation`;
                  return (
                    <li key={draft.id} className="studio-draft-card">
                      <div>
                        <h3 className="font-editorial text-xl">{title}</h3>
                        <p className="text-sm">
                          {template} · Updated{" "}
                          <time dateTime={draft.updatedAt}>
                            {updatedDate.format(new Date(draft.updatedAt))} UTC
                          </time>
                        </p>
                      </div>
                      <StudioDraftLink id={draft.id} title={title} />
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap gap-4">
              {cursor.success && (
                <Link href="/studio" className="studio-link">
                  First page
                </Link>
              )}
              {result.nextCursor && (
                <Link
                  href={`/studio?after=${result.nextCursor}`}
                  className="studio-link"
                  prefetch={false}
                >
                  More drafts
                </Link>
              )}
            </div>
          </>
        )}
      </section>
      {publications === null && (
        <p role="alert">Couldn’t load published invitations.</p>
      )}
      {publications && publications.length > 0 && (
        <section
          aria-labelledby="published-heading"
          className="studio-draft-list"
        >
          <h2 id="published-heading" className="font-editorial text-2xl">
            Published invitations
          </h2>
          <ul className="studio-draft-list">
            {publications.map((publication) => (
              <li className="studio-draft-card" key={publication.id}>
                <h3 className="font-editorial text-xl">
                  {publication.test_publication_title}
                </h3>
                <Link
                  className="studio-link"
                  href={publishPath(publication.id)}
                  prefetch={false}
                >
                  View and share
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </StudioShell>
  );
}
