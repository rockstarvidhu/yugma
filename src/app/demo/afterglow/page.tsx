import type { Metadata } from "next";
import { DemoPreview } from "@/components/preview/DemoPreview";
import { getSupabaseConfig } from "@/lib/auth/client";
import { canStartAfterglowTestDraft } from "@/lib/checkout/gateway";

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
      studioAvailable={
        getSupabaseConfig() !== null && canStartAfterglowTestDraft()
      }
    />
  );
}
