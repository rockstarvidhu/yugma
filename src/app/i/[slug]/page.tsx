import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import { invitationDescription, invitationPath } from "@/lib/publish/contract";
import { loadPublicInvitation } from "@/lib/publish/store";

export const dynamic = "force-dynamic";
const load = cache(loadPublicInvitation);

export async function generateMetadata({
  params,
}: PageProps<"/i/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const invitation = await load(slug);
  if (!invitation) notFound();
  const title = invitation.title;
  const description = invitationDescription(title);
  const url = invitationPath(slug);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function InvitationPage({
  params,
}: PageProps<"/i/[slug]">) {
  const { slug } = await params;
  const invitation = await load(slug);
  if (!invitation) notFound();
  const publishedCover = invitation.cover
    ? { ...invitation.cover, src: `${invitationPath(slug)}/cover` }
    : undefined;
  return (
    <InvitationRenderer
      templateId={invitation.registry_key}
      invitation={invitation.data}
      publishedCover={publishedCover}
    />
  );
}
