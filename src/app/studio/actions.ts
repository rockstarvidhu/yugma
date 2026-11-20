"use server";

import { redirect } from "next/navigation";
import { getServerAuth, getVerifiedSession } from "@/lib/auth/server";
import { createDraft } from "@/lib/drafts/store";

export async function startAfterglowDraft() {
  const session = await getVerifiedSession().catch(() => undefined);
  if (session === null) redirect("/sign-in?next=%2Fstudio");
  if (!session) redirect("/studio?error=create-draft");

  const draft = await createDraft(session.ownerId, "afterglow", {}).catch(
    () => null,
  );
  if (!draft) redirect("/studio?error=create-draft");
  redirect(`/studio/${draft.id}`);
}

export async function signOut() {
  const client = await getServerAuth({ writeCookies: true });
  if (client) {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) redirect("/studio?error=sign-out");
  }
  redirect("/sign-in");
}
