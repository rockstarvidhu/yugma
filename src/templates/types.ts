import type { ComponentType } from "react";
import type { Invitation } from "@/types/invitation";

export type InvitationTemplateProps = { invitation: Invitation };
export type TemplateDefinition = {
  readonly id: string;
  readonly Component: ComponentType<InvitationTemplateProps>;
};
