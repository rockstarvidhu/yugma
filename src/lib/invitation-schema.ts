import { z } from "zod";
import type { Invitation } from "@/types/invitation";

const text = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`);

const webUrl = (label: string) =>
  z.url({ error: `${label} must be a valid URL.` }).pipe(
    z.string().refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "https:" || protocol === "http:";
    }, `${label} must use http or https.`),
  );

const kolkataDateTime = z.iso
  .datetime({ offset: true, message: "Use an ISO 8601 date and time." })
  .refine((value) => value.endsWith("+05:30"), {
    message: "Use the Asia/Kolkata offset (+05:30).",
  })
  .refine(
    (value) => {
      const instant = new Date(value);
      if (Number.isNaN(instant.getTime())) return false;

      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(instant);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((item) => item.type === type)?.value;
      const localTime = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
      return localTime === value.slice(0, 19);
    },
    { message: "Date and time must match the Asia/Kolkata local time." },
  );

export const weddingVenueSchema = z.object({
  name: text("Venue name", 120),
  address: text("Venue address", 240),
  mapsUrl: webUrl("Map URL"),
});

export const weddingEventSchema = z.object({
  title: text("Event name", 100),
  startsAt: kolkataDateTime,
  venue: weddingVenueSchema.optional(),
  location: text("Event location", 240).optional(),
  dressCode: text("Dress code", 100).optional(),
  description: text("Ceremony description", 500).optional(),
});

export const invitationSchema = z.object({
  couple: z.object({
    partnerOne: text("First couple name", 80),
    partnerTwo: text("Second couple name", 80),
  }),
  welcomeNote: text("Welcome note", 500).optional(),
  hosts: z
    .array(text("Host name", 80))
    .max(10, "List up to 10 hosts.")
    .optional(),
  coverImage: webUrl("Cover image URL"),
  events: z
    .array(weddingEventSchema)
    .min(1, "Add at least one wedding function.")
    .max(5, "An invitation can include at most 5 wedding functions."),
}) satisfies z.ZodType<Invitation>;

export type InvitationInput = z.input<typeof invitationSchema>;
export type ValidatedInvitation = z.output<typeof invitationSchema>;
