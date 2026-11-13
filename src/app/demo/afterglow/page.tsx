import type { Metadata } from "next";
import { DemoPreview } from "@/components/preview/DemoPreview";

export const metadata: Metadata = {
  title: "Afterglow demo",
  description:
    "A fictional YUGMA invitation preview in warm ivory and burgundy.",
  robots: { index: false, follow: false },
};

export default function AfterglowDemo() {
  return <DemoPreview />;
}
