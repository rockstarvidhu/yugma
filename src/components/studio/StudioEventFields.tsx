import { Button } from "@/components/ui/Button";
import type { DraftEvent } from "@/lib/studio/draft-fields";
import { StudioField } from "./StudioField";

export function StudioEventFields({
  event,
  index,
  localDate,
  issues,
  disabled,
  update,
  updateDate,
  remove,
}: {
  event: DraftEvent;
  index: number;
  localDate: string;
  issues: Record<string, string>;
  disabled: boolean;
  update: (patch: Partial<DraftEvent>) => void;
  updateDate: (value: string) => void;
  remove: () => void;
}) {
  const n = index + 1;
  const prefix = `events.${index}`;
  const venue = event.venue ?? {};

  function changeVenue(key: "name" | "address", value: string) {
    const changed = (venue[key] ?? "").trim() !== value.trim();
    update({
      venue: {
        ...venue,
        [key]: value,
        mapsUrl: changed ? undefined : venue.mapsUrl,
      },
    });
  }

  return (
    <fieldset disabled={disabled} className="studio-events">
      <legend>Ceremony {n}</legend>
      <div className="studio-grid">
        <StudioField
          path={`${prefix}.title`}
          label="Ceremony name"
          value={event.title}
          onChange={(title) => update({ title })}
          issues={issues}
        />
        <StudioField
          path={`${prefix}.startsAt`}
          label="Date and time"
          type="datetime-local"
          value={localDate}
          onChange={updateDate}
          issues={issues}
        />
        <StudioField
          path={`${prefix}.venue.name`}
          label="Venue name"
          value={venue.name}
          onChange={(name) => changeVenue("name", name)}
          issues={issues}
        />
        <StudioField
          path={`${prefix}.venue.address`}
          label="Venue address"
          value={venue.address}
          onChange={(address) => changeVenue("address", address)}
          issues={issues}
        />
        <StudioField
          path={`${prefix}.venue.mapsUrl`}
          label="Map link"
          type="url"
          value={venue.mapsUrl}
          onChange={(mapsUrl) => update({ venue: { ...venue, mapsUrl } })}
          hint="Changing the venue name or address clears its map link."
          issues={issues}
        />
        <StudioField
          path={`${prefix}.location`}
          label="Location note"
          value={event.location}
          onChange={(location) => update({ location })}
          issues={issues}
        />
        <StudioField
          path={`${prefix}.dressCode`}
          label="Dress code"
          value={event.dressCode}
          onChange={(dressCode) => update({ dressCode })}
          issues={issues}
        />
      </div>
      <StudioField
        path={`${prefix}.description`}
        label="Ceremony description"
        multiline
        value={event.description}
        onChange={(description) => update({ description })}
        issues={issues}
      />
      <div>
        <Button
          variant="ghost"
          aria-label={`Remove ceremony ${n}`}
          onClick={remove}
        >
          Remove ceremony
        </Button>
      </div>
    </fieldset>
  );
}
