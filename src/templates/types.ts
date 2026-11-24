import type { StorefrontTemplate } from "./storefront-listing";
import type { ComponentType } from "react";
import type { CoverPhotoSource } from "@/lib/cover-photo";
import type { Invitation } from "@/types/invitation";

export type InvitationTemplateProps = {
  invitation: Invitation;
  trustedImageOrigin?: string;
  privateDraftId?: string;
  publishedCover?: CoverPhotoSource;
  embedded?: boolean;
};
export type TemplateDefinition = {
  readonly id: string;
  readonly listing?: StorefrontTemplate;
  readonly Component: ComponentType<InvitationTemplateProps>;
};
