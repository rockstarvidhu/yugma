import { z } from "zod";
import { invitationSchema } from "@/lib/invitation-schema";
import type { Invitation } from "@/types/invitation";

function wallTimeFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function wallTime(formatter: Intl.DateTimeFormat, instant: number) {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function eventFields(
  event: Invitation["events"][number],
  timeZone: string,
) {
  return {
    ...wallTime(wallTimeFormatter(timeZone), Date.parse(event.startsAt)),
    venueName: event.venue.name,
    venueAddress: event.venue.address,
  };
}

export type PreviewFields = {
  partnerOne: string;
  partnerTwo: string;
  welcomeNote: string;
  events: ReturnType<typeof eventFields>[];
};

export function previewFields(invitation: Invitation): PreviewFields {
  return {
    ...invitation.couple,
    welcomeNote: invitation.welcomeNote ?? "",
    events: invitation.events.map((event) =>
      eventFields(event, invitation.timeZone),
    ),
  };
}

const calendarDate = z.iso.date();
const clockTime = z.iso.time({ precision: -1 });
const hour = 3_600_000;

function resolveStart(
  date: string,
  time: string,
  original: string,
  formatter: Intl.DateTimeFormat,
) {
  const before = wallTime(formatter, Date.parse(original));
  if (before.date === date && before.time === time) return original;

  const requested = Date.parse(`${date}T${time}:00Z`);
  const candidates: number[] = [];
  // Probe offsets on both sides of a nearby clock change, then round-trip each
  // candidate through the invitation timezone to rule out nonexistent times.
  for (const shift of [-36, 0, 36]) {
    const probe = requested + shift * hour;
    const local = wallTime(formatter, probe);
    const offset = Date.parse(`${local.date}T${local.time}:00Z`) - probe;
    const candidate = requested - offset;
    if (!Number.isFinite(candidate)) continue;
    const result = wallTime(formatter, candidate);
    if (result.date === date && result.time === time)
      candidates.push(candidate);
  }
  // For a newly entered repeated time, use its earlier occurrence.
  return candidates.length
    ? new Date(Math.min(...candidates)).toISOString()
    : undefined;
}

export function validatePreview(original: Invitation, fields: PreviewFields) {
  const errors: Record<string, string> = {};
  const formatter = wallTimeFormatter(original.timeZone);
  const events = original.events.map((event, index) => {
    const { date, time, venueName, venueAddress } = fields.events[index];
    const dateValid = calendarDate.safeParse(date).success;
    const timeValid = clockTime.safeParse(time).success;
    if (!dateValid)
      errors[`events.${index}.date`] = "Enter a valid celebration date.";
    if (!timeValid)
      errors[`events.${index}.time`] = "Enter a valid celebration time.";
    let startsAt = event.startsAt;
    if (dateValid && timeValid) {
      const resolved = resolveStart(date, time, event.startsAt, formatter);
      if (resolved) startsAt = resolved;
      else
        errors[`events.${index}.time`] =
          `This time does not exist in ${original.timeZone}. Choose another time.`;
    }

    const name = venueName.trim();
    const address = venueAddress.trim();
    const venueChanged =
      name !== event.venue.name || address !== event.venue.address;
    return {
      ...event,
      startsAt,
      ...(venueChanged ? { location: undefined } : {}),
      venue: {
        ...event.venue,
        name,
        address,
        mapsUrl: venueChanged ? undefined : event.venue.mapsUrl,
      },
    };
  });

  const parsed = invitationSchema.safeParse({
    ...original,
    couple: { partnerOne: fields.partnerOne, partnerTwo: fields.partnerTwo },
    welcomeNote: fields.welcomeNote,
    events,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".")] ??= issue.message;
    }
  }
  if (!parsed.success || Object.keys(errors).length) return { errors };
  return { invitation: parsed.data };
}
