# Venue and directions integration

Afterglow uses native fragment links in normal document flow to reach the
celebration (`#celebration`) and wedding venues (`#venues`). The cover is followed
by the story, chronological timeline, venue section, and closing.

The timeline displays localized dates and times, the invitation timezone,
ceremony descriptions, and attire. Afterglow moves venue details into its
separate venue section. Other EventTimeline consumers retain inline VenueCards
by default. Events with the same trimmed venue name and address and matching
map destinations share one card. For comparison, the URL parser normalizes
standard URL formatting, removes `utm_*`, `gclid`, and `fbclid`, and sorts the
remaining parameters by name. Repeated values for the same name retain their
relative order. Paths and fragments stay part of the identity. Google Maps'
documented directions URLs use query parameters for destinations, but fragments
can carry provider-specific client-side state, so even fragment-only variations
are kept separate.
Missing and blank URLs use the same comparison value. The first event's
original validated map URL supplies the directions link. Each card lists its
associated events and any event-specific location detail.

VenueCard uses the canonical map URL validator. A missing or invalid URL leaves
the venue details visible. Name and address are required by the canonical
schema. Directions links identify the venue and address to assistive technology
and open in a separate tab without access to the opener.
