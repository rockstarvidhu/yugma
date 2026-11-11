// Compatibility import path: every public model is inferred from its Zod schema.
export type {
  Invitation,
  WeddingEvent,
  WeddingVenue,
  Partner,
  Couple,
  InvitationImage,
  FocalPosition,
  InvitationInput,
} from "@/lib/invitation-schema";

/** @deprecated A legacy suggested zone only; use each invitation's required timeZone. */
export const INVITATION_TIME_ZONE = "Asia/Kolkata" as const;
