import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  StudioShell,
  StudioUnavailable,
} from "@/components/studio/StudioShell";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { canCreatePrivateDraft } from "@/lib/auth/service";
import { getStorefrontCatalogue } from "@/lib/storefront-catalogue";
import { templateRegistry } from "@/templates/registry";
import { CreateInvitation } from "./CreateInvitation";

export const metadata: Metadata = {
  title: "Create an invitation",
  robots: { index: false, follow: false },
};

export default async function CreatePage({
  params,
}: PageProps<"/create/[template]">) {
  const { template } = await params;
  if (!templateRegistry.get(template)) notFound();
  await requireStudioUser(`/create/${template}`);
  const client = await getServerAuth();
  if (!client || !canCreatePrivateDraft())
    return (
      <StudioUnavailable>
        Draft creation is currently unavailable. Please try again later.
      </StudioUnavailable>
    );
  const { data, error } = await client
    .from("templates")
    .select("draft_eligible")
    .eq("registry_key", template)
    .maybeSingle();
  if (error)
    return (
      <StudioUnavailable>
        We couldn’t check template availability. Please try again.
      </StudioUnavailable>
    );
  if (data?.draft_eligible !== true)
    return (
      <StudioUnavailable>
        This design is currently unavailable for private drafts.
      </StudioUnavailable>
    );
  const name =
    getStorefrontCatalogue().find((design) => design.templateId === template)
      ?.name ?? "an invitation";

  return (
    <StudioShell
      title={`Create ${name}`}
      back={
        <Link href="/studio" className="studio-link">
          Back to Studio
        </Link>
      }
    >
      <CreateInvitation templateKey={template} />
    </StudioShell>
  );
}
