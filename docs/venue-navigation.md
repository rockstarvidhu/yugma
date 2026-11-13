# Venue and directions integration

Afterglow uses native fragment links in normal document flow to reach the
celebration (`#celebration`) and wedding venues (`#venues`). The cover is followed
by the story, chronological timeline, venue section, and closing.

The timeline displays localized dates and times, the invitation timezone,
ceremony descriptions, and attire. Afterglow moves venue details into its
separate venue section. Other EventTimeline consumers retain inline VenueCards
by default. Events with matching canonical venue name, address, and map URL
share one card and one directions link. Each card lists its associated events
and any event-specific location detail.

VenueCard uses the canonical map URL validator. A missing or invalid URL leaves
the venue details visible. Name and address are required by the canonical
schema. Directions open in a separate tab without access to the opener.
