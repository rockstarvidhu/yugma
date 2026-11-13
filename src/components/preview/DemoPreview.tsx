import { shellDemoInvitation } from "@/templates/internal/demo-invitation";
import { PreviewShell } from "./PreviewShell";

export function DemoPreview() {
  const configuredOrigin =
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);
  let trustedImageOrigin: string | undefined;
  if (configuredOrigin) trustedImageOrigin = new URL(configuredOrigin).origin;

  return (
    <PreviewShell
      sample={shellDemoInvitation}
      templateId="afterglow"
      trustedImageOrigin={trustedImageOrigin}
    />
  );
}
