import { z } from "zod";

export const MAX_EVENTS = 5;
export const MAX_GALLERY_IMAGES = 20;

const text = (label: string, maxLength: number) =>
  z.string().trim().min(1, `${label} is required.`).max(maxLength);
const optionalText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(text(label, maxLength).optional())
    .optional();
const webUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(2048)
    .pipe(z.url({ error: `${label} must be a valid URL.` }))
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    }, `${label} must use HTTP/HTTPS without credentials.`);

export const timeZoneSchema = text("IANA timezone", 100).refine((value) => {
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}, "Use a valid IANA timezone, such as Asia/Kolkata or Europe/London.");

const eventDateTime = z
  .string()
  .max(64)
  .pipe(z.iso.datetime({ offset: true }))
  .refine(
    (value) => Number.isFinite(Date.parse(value)),
    "Use a valid calendar date and time with an offset or Z.",
  );

// Partner values remain display names, preserving the existing couple structure.
export const partnerSchema = text("Partner name", 80);
export const coupleSchema = z.object({
  partnerOne: partnerSchema,
  partnerTwo: partnerSchema,
});
export const focalPositionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export const invitationImageSchema = z.object({
  src: webUrl("Image URL"),
  alt: text("Image description", 240),
  caption: optionalText("Image caption", 500),
  focalPosition: focalPositionSchema.optional(),
});

export const weddingVenueSchema = z.object({
  name: text("Venue name", 120),
  address: text("Venue address", 240),
  mapsUrl: webUrl("Map URL"),
});
export const weddingEventSchema = z.object({
  id: text("Event ID", 100),
  title: text("Event name", 100),
  startsAt: eventDateTime,
  venue: weddingVenueSchema,
  dressCode: optionalText("Dress code", 100),
});
export const invitationSchema = z
  .object({
    couple: coupleSchema,
    timeZone: timeZoneSchema,
    welcomeNote: optionalText("Welcome note", 500),
    hosts: z.array(text("Host name", 80)).max(10).optional(),
    coverImage: invitationImageSchema.optional(),
    gallery: z.array(invitationImageSchema).max(MAX_GALLERY_IMAGES).optional(),
    events: z
      .array(weddingEventSchema)
      .min(1, "Add at least one wedding function.")
      .max(
        MAX_EVENTS,
        `An invitation can include at most ${MAX_EVENTS} wedding functions.`,
      ),
  })
  .superRefine((invitation, ctx) => {
    const ids = new Set<string>();
    invitation.events.forEach((event, index) => {
      if (ids.has(event.id))
        ctx.addIssue({
          code: "custom",
          path: ["events", index, "id"],
          message: "Event IDs must be unique within an invitation.",
        });
      ids.add(event.id);
    });
  });

export type Invitation = z.infer<typeof invitationSchema>;
export type WeddingEvent = z.infer<typeof weddingEventSchema>;
export type WeddingVenue = z.infer<typeof weddingVenueSchema>;
export type Partner = z.infer<typeof partnerSchema>;
export type Couple = z.infer<typeof coupleSchema>;
export type InvitationImage = z.infer<typeof invitationImageSchema>;
export type FocalPosition = z.infer<typeof focalPositionSchema>;
// Raw form input can contain blank optional text; parsing normalizes it to undefined.
export type InvitationInput = z.input<typeof invitationSchema>;
