import type { Metadata } from "next";
import { DemoWatermark } from "@/components/preview/DemoWatermark";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import { shellDemoInvitation } from "@/templates/internal/demo-invitation";

export const metadata: Metadata = {
  title: "Afterglow demo",
  description:
    "A fictional YUGMA invitation preview in warm ivory and burgundy.",
  robots: { index: false, follow: false },
};

export default function AfterglowDemo() {
  return (
    <>
      <DemoWatermark />
      <InvitationRenderer
        templateId="afterglow"
        invitation={shellDemoInvitation}
      />
    </>
  );
}
