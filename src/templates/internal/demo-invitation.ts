import type { TemporaryInvitation } from "./temporary-invitation";

// Entirely fictional renderer fixture. Replace with validated canonical data after Track A merges.
export const shellDemoInvitation = {
  names: ["Tara", "Neel"],
  welcome:
    "With full hearts and our favourite people, we begin a new chapter. Join us for a day of love, laughter and togetherness.",
  timeZone: "Asia/Kolkata",
  events: [
    {
      id: "demo-celebration",
      title: "Wedding celebration",
      startsAt: "2027-12-12T17:30:00+05:30",
      venue: "The Marigold Courtyard",
      address: "A fictional garden venue · Jaipur, Rajasthan",
    },
  ],
} satisfies TemporaryInvitation;
