import type { WeddingVenue } from "@/types/invitation";

type VenueIdentityFields = Pick<WeddingVenue, "name" | "address"> &
  Partial<Pick<WeddingVenue, "mapsUrl">>;

function mapDestinationKey(mapsUrl?: string) {
  const source = mapsUrl?.trim();
  if (!source) return null;

  try {
    const url = new URL(source);
    const destinationParams = new URLSearchParams();
    for (const [name, value] of url.searchParams) {
      const parameter = name.toLowerCase();
      if (
        parameter.startsWith("utm_") ||
        parameter === "gclid" ||
        parameter === "fbclid"
      ) {
        continue;
      }
      destinationParams.append(name, value);
    }
    url.search = destinationParams.toString();
    return url.href;
  } catch {
    // Keep unparseable values distinct. VenueCard validates links separately.
    return source;
  }
}

/** Compare venues without rewriting the directions link shown to guests. */
export function venueIdentity({ name, address, mapsUrl }: VenueIdentityFields) {
  return JSON.stringify([
    name.trim(),
    address.trim(),
    mapDestinationKey(mapsUrl),
  ]);
}
