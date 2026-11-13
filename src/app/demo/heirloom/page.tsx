import type { Metadata } from "next";
import { DemoWatermark } from "@/components/preview/DemoWatermark";
import { InvitationRenderer } from "@/invitations/renderer/InvitationRenderer";
import { shellDemoInvitation } from "@/templates/internal/demo-invitation";

export const metadata: Metadata = {
  title: "Heirloom demo",
  description: "A fictional YUGMA wedding invitation sample preview.",
  robots: { index: false, follow: false },
};

export default function HeirloomDemo() {
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
