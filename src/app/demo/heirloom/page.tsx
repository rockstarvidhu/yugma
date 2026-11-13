import type { Metadata } from "next";
import { DemoPreview } from "@/components/preview/DemoPreview";

export const metadata: Metadata = {
  title: "Heirloom demo",
  description: "A fictional YUGMA wedding invitation sample preview.",
  robots: { index: false, follow: false },
};

export default function HeirloomDemo() {
  return <DemoPreview />;
}
