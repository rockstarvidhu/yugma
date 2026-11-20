import { notFound } from "next/navigation";
import { requireStudioUser } from "@/lib/auth/server";

export default async function DraftStudioPage({
  params,
}: PageProps<"/studio/[id]">) {
  const { id } = await params;
  await requireStudioUser(`/studio/${id}`);
  notFound();
}
