import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { canCreatePrivateDraft } from "@/lib/auth/service";
import { draftIdSchema } from "@/lib/drafts/contract";
import { listDrafts } from "@/lib/drafts/store";
import { signOut, startAfterglowDraft } from "./actions";

export const metadata: Metadata = {
  title: "Your studio",
  robots: { index: false, follow: false },
};

export default async function StudioPage({
  searchParams,
}: PageProps<"/studio">) {
  const user = await requireStudioUser("/studio");
  const query = await searchParams;
  const client = await getServerAuth();
  const cursor = draftIdSchema.safeParse(query.after);
  const { drafts, nextCursor } = client
    ? await listDrafts(
        { client, ownerId: user.id },
        cursor.success ? cursor.data : null,
      )
    : { drafts: [], nextCursor: null };

  return (
    <main className="yugma-brand min-h-screen py-12">
      <Container className="grid max-w-lg gap-6">
        <BrandLogo href="/" label="YUGMA home" className="w-32" />
        <h1 className="font-editorial text-4xl">Your studio</h1>
        {query.error === "sign-out" && (
          <p role="alert">Couldn’t sign out. Try again.</p>
        )}
        {query.error === "create-draft" && (
          <p role="alert">Couldn’t start an Afterglow draft. Try again.</p>
        )}
        <section aria-labelledby="drafts-heading" className="grid gap-3">
          <h2 id="drafts-heading" className="font-editorial text-2xl">
            Your drafts
          </h2>
          {drafts.length === 0 ? (
            <p>No drafts yet.</p>
          ) : (
            <ul className="grid gap-2">
              {drafts.map((draft) => {
                const couple = draft.data.couple;
                const names = [couple?.partnerOne, couple?.partnerTwo]
                  .filter(Boolean)
                  .join(" & ");
                return (
                  <li key={draft.id}>
                    <Link href={`/studio/${draft.id}`} className="underline">
                      {names ||
                        (draft.templateKey === "afterglow"
                          ? "Afterglow draft"
                          : "Invitation draft")}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {nextCursor && (
            <Link href={`/studio?after=${nextCursor}`} className="underline">
              More drafts
            </Link>
          )}
          {canCreatePrivateDraft() && (
            <form action={startAfterglowDraft}>
              <Button type="submit">Start an Afterglow draft</Button>
            </form>
          )}
        </section>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Container>
    </main>
  );
}
