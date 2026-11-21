import type { Metadata } from "next";
import { DemoPreview } from "@/components/preview/DemoPreview";
import { canCreatePrivateDraft } from "@/lib/auth/service";

export const metadata: Metadata = {
  title: "Afterglow demo",
  description:
    "A fictional YUGMA invitation preview in warm ivory and burgundy.",
  robots: { index: false, follow: false },
};

export default async function AfterglowDemo({
  searchParams,
}: PageProps<"/demo/afterglow">) {
  const { personalize } = await searchParams;
  return (
    <DemoPreview
      initiallyEditing={personalize === "1"}
      studioAvailable={canCreatePrivateDraft()}
    />
  );
}
