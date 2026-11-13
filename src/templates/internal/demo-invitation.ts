import { invitationSchema } from "@/lib/invitation-schema";
import type { InvitationInput } from "@/types/invitation";

// Fictional preview data is validated before it reaches the renderer.
export const shellDemoInvitation = invitationSchema.parse({
  couple: { partnerOne: "Tara", partnerTwo: "Neel" },
  welcomeNote:
    "With full hearts and our favourite people, we begin a new chapter. Join us for a day of love, laughter and togetherness.",
  closingNote:
    "We can't wait to share a meal, a dance and the start of this next chapter with you.",
  hosts: ["The families of Tara and Neel"],
  timeZone: "Asia/Kolkata",
  events: [
    {
      id: "demo-celebration",
      title: "Wedding celebration",
      startsAt: "2027-12-12T17:30:00+05:30",
      venue: {
        name: "The Marigold Courtyard",
        address: "A fictional garden venue · Jaipur, Rajasthan",
        mapsUrl: "https://maps.google.com/?q=Jaipur+Rajasthan",
      },
    },
  ],
} satisfies InvitationInput);
