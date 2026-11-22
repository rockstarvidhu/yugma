import {
  invitationDraftSchema,
  invitationSchema,
  timeZoneSchema,
  weddingEventSchema,
  type InvitationDraft,
} from "@/lib/invitation-schema";
import { resolveEventStart } from "@/lib/preview-invitation";
import type { FieldIssue } from "./draft-client";

export type DraftEvent = NonNullable<InvitationDraft["events"]>[number];
export type DateFields = Record<string, string>;

const blankToUndefined = (value?: string) => value?.trim() || undefined;

export function readEditorSnapshot(
  data: InvitationDraft,
  dateFields: DateFields,
) {
  const issues: FieldIssue[] = [];
  const timeZone = blankToUndefined(data.timeZone);
  const zone = timeZoneSchema.safeParse(timeZone);
  const events = data.events?.map((event, index) => {
    let { startsAt } = event;
    if (Object.hasOwn(dateFields, event.id)) {
      const local = dateFields[event.id];
      if (!local) startsAt = undefined;
      else if (!zone.success) {
        issues.push({
          path: "timeZone",
          message:
            "Enter a valid timezone before setting a ceremony date and time.",
        });
      } else {
        const converted = resolveEventStart(local, zone.data, startsAt);
        if ("error" in converted)
          issues.push({
            path: `events.${index}.startsAt`,
            message: converted.error,
          });
        else startsAt = converted.startsAt;
      }
    }
    return {
      ...event,
      title: blankToUndefined(event.title),
      startsAt,
      venue: event.venue && {
        name: blankToUndefined(event.venue.name),
        address: blankToUndefined(event.venue.address),
        mapsUrl: blankToUndefined(event.venue.mapsUrl),
      },
    };
  });
  const parsed = invitationDraftSchema.safeParse({
    ...data,
    timeZone,
    couple: data.couple && {
      partnerOne: blankToUndefined(data.couple.partnerOne),
      partnerTwo: blankToUndefined(data.couple.partnerTwo),
    },
    events,
  });
  if (!parsed.success)
    issues.push(
      ...parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  return parsed.success && !issues.length
    ? { snapshot: parsed.data }
    : { issues };
}

export function prepareStudioPreview(draft: InvitationDraft) {
  const events = (draft.events ?? []).flatMap((event) => {
    const parsed = weddingEventSchema.safeParse(event);
    return parsed.success ? [parsed.data] : [];
  });
  const parsed = invitationSchema.safeParse({ ...draft, events });
  if (!parsed.success)
    return {
      guidance:
        "To preview, add both partner names, a timezone, and at least one ceremony with a name, date and time, venue name, and address. You can save your draft before those details are complete.",
    };
  return {
    invitation: parsed.data,
    skipped: (draft.events?.length ?? 0) - events.length,
  };
}
