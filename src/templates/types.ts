import type { ComponentType } from "react";
import type { TemporaryInvitation } from "./internal/temporary-invitation";

// Replace this boundary with the canonical Invitation import after Track A merges.
export type InvitationTemplateProps = { invitation: TemporaryInvitation };
export type TemplateDefinition = {
  readonly id: string;
  readonly Component: ComponentType<InvitationTemplateProps>;
};
