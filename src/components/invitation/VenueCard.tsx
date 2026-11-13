import { weddingVenueSchema } from "@/lib/invitation-schema";
import type { WeddingEvent, WeddingVenue } from "@/types/invitation";

type VenueCardProps = {
  venue: Pick<WeddingVenue, "name" | "address"> &
    Partial<Pick<WeddingVenue, "mapsUrl">>;
  location?: WeddingEvent["location"];
  eventTitle?: WeddingEvent["title"];
};

export function VenueCard({ venue, location, eventTitle }: VenueCardProps) {
  const { name, address, mapsUrl } = venue;
  const directions = weddingVenueSchema.shape.mapsUrl.safeParse(mapsUrl);
  const destination = `${name}, ${address}${eventTitle ? ` for ${eventTitle}` : ""}`;

  return (
    <div className="mt-2 min-w-0 text-sm leading-6 [overflow-wrap:anywhere]">
      {eventTitle && <p className="text-muted">{eventTitle}</p>}
      <p className="font-medium text-foreground">{name}</p>
      <p className="mt-0.5 text-muted">{address}</p>
      {location && location !== name && (
        <p className="mt-0.5 text-muted">{location}</p>
      )}
      {directions.success && (
        <a
          aria-label={`Get Directions to ${destination} (opens in a new tab)`}
          href={directions.data}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 items-center font-medium text-heading underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Get Directions
        </a>
      )}
    </div>
  );
}
