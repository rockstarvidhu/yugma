import { loadDraft, saveDraft } from "@/lib/drafts/http";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/drafts/[id]">,
) {
  return loadDraft((await context.params).id);
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/drafts/[id]">,
) {
  return saveDraft(request, (await context.params).id);
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/drafts/[id]">,
) {
  return saveDraft(request, (await context.params).id, "replace");
}
