import { z } from "zod";

export const shareSlugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const publicationTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(170)
  .refine((value) => value.isWellFormed() && !value.includes("\0"));
export const publishRequestSchema = z.strictObject({
  title: publicationTitleSchema,
  slug: shareSlugSchema,
  expectedVersion: z.number().int().positive().max(2_147_483_647),
  confirmed: z.literal(true),
});

export const publishPath = (id: string) => `/publish/${id}`;
export const invitationPath = (slug: string) => `/i/${slug}`;

export function invitationTitle(couple: {
  partnerOne: string;
  partnerTwo: string;
}) {
  return `${couple.partnerOne} & ${couple.partnerTwo}`;
}

export function invitationDescription(title: string) {
  return `You're invited to celebrate with ${title}. View the invitation for ceremony and venue details.`;
}
