import { shellDemoInvitation } from "@/templates/internal/demo-invitation";
import { PreviewShell } from "./PreviewShell";

export function DemoPreview({
  liveEditing = false,
  initiallyEditing = false,
  studioAvailable = false,
}: {
  liveEditing?: boolean;
  initiallyEditing?: boolean;
  studioAvailable?: boolean;
}) {
  const configuredOrigin =
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);
  let trustedImageOrigin: string | undefined;
  if (configuredOrigin) trustedImageOrigin = new URL(configuredOrigin).origin;

  return (
    <PreviewShell
      key={String(initiallyEditing)}
      sample={shellDemoInvitation}
      templateId="afterglow"
      trustedImageOrigin={trustedImageOrigin}
      liveEditing={liveEditing}
      initiallyEditing={initiallyEditing}
      studioAvailable={studioAvailable}
    />
  );
}
