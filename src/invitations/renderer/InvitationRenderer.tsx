import { templateRegistry } from "@/templates/registry";
import type { InvitationTemplateProps } from "@/templates/types";

export function InvitationRenderer({
  templateId,
  invitation,
  registry = templateRegistry,
}: InvitationTemplateProps & {
  templateId: string;
  registry?: typeof templateRegistry;
}) {
  const template = registry.get(templateId);
  if (!template)
    return <p role="status">This invitation template is unavailable.</p>;
  const Template = template.Component;
  return <Template invitation={invitation} />;
}
