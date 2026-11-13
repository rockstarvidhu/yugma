import type { ComponentType } from "react";
import type { Invitation } from "@/types/invitation";

export type InvitationTemplateProps = {
  invitation: Invitation;
  trustedImageOrigin?: string;
};
export type TemplateDefinition = {
  readonly id: string;
  readonly Component: ComponentType<InvitationTemplateProps>;
};
