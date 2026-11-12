import type { InvitationImage } from "@/types/invitation";

export const demoCoverPhotoUrl =
  "https://images.unsplash.com/photo-1754782540893-2122877f2975?auto=format&fit=crop&w=2400&q=80";

// Resolve canonical image references to trusted assets before passing them to Next.
export function resolveCoverPhoto(photo?: InvitationImage) {
  if (photo?.src !== demoCoverPhotoUrl) return undefined;
  return { ...photo, src: "/invitations/heirloom-demo.jpg" };
}
