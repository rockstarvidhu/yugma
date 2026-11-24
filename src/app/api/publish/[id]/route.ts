import { getVerifiedSession } from "@/lib/auth/server";
import { draftIdSchema } from "@/lib/drafts/contract";
import { loadDraft } from "@/lib/drafts/store";
import { parseJson, readJsonBodyBytes } from "@/lib/http-json";
import { publishRequestSchema } from "@/lib/publish/contract";
import {
  loadOwnerPublication,
  publishTestInvitation,
  stagingPublishingEnabled,
} from "@/lib/publish/store";
import { invitationSchema } from "@/lib/invitation-schema";

const respond = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const failure = (status: number, error: string) => respond({ error }, status);

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/publish/[id]">,
) {
  const { id } = await params;
  if (!stagingPublishingEnabled() || !draftIdSchema.safeParse(id).success)
    return failure(404, "Invitation unavailable.");

  try {
    const session = await getVerifiedSession();
    if (!session) return failure(401, "Sign in to publish your invitation.");
    const input = publishRequestSchema.safeParse(
      parseJson(await readJsonBodyBytes(request, 4096)),
    );
    if (!input.success)
      return failure(400, "Review and confirm the title and link.");

    const existing = await loadOwnerPublication(session, id);
    if (!existing) {
      const draft = await loadDraft(session, id);
      if (!draft || draft.templateKey !== "afterglow")
        return failure(404, "Invitation unavailable.");
      if (draft.version !== input.data.expectedVersion)
        return failure(
          409,
          "Your draft changed. Reload this page to review it again.",
        );
      if (!invitationSchema.safeParse(draft.data).success)
        return failure(
          422,
          "Complete all invitation details before publishing.",
        );
    }

    const outcome = await publishTestInvitation(
      session.ownerId,
      id,
      input.data,
    );
    switch (outcome) {
      case "unpaid":
        return failure(403, "An active test payment is required to publish.");
      case "stale":
        return failure(
          409,
          "Your draft changed. Reload this page to review it again.",
        );
      case "slug_taken":
        return failure(409, "This link is already in use. Choose another.");
      case "missing":
        return failure(404, "Invitation unavailable.");
      case "invalid_media":
        return failure(
          422,
          "Choose a cover photo uploaded to this invitation or remove it before publishing.",
        );
      case "invalid":
        return failure(400, "Review and confirm the title and link.");
      case "published": {
        const publication = await loadOwnerPublication(session, id);
        if (!publication) return failure(404, "Invitation unavailable.");
        return respond({ slug: publication.share_slug });
      }
    }
  } catch {
    return failure(503, "Publishing is temporarily unavailable. Try again.");
  }
}
