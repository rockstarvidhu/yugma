# Venue and directions integration

EventTimeline uses VenueCard for each event, including its existing directions
action. The card uses the canonical venue fields and the same map URL validator.
A missing or invalid URL leaves the venue details visible. Name and address are
required by the canonical schema. No location is inferred from an address.

QuickLinks accepts IDs for sections actually rendered on the page and omits any
unspecified destination. It uses native fragment links in normal document flow.

## After Track A merges

1. Merge updated main into this branch and preserve Track A's section order.
2. In Afterglow, render QuickLinks in place of the cover's existing schedule
   jump and pass the timeline's existing `celebration` ID.
3. Add a labeled venue section with the stable ID `venues` between the timeline
   and closing. Render VenueCard for each event there with its event title.
   Pass `venues` to QuickLinks only when that section renders.
4. Give EventTimeline an explicit presentation option to omit the inline
   VenueCards when the separate venue section is present, so each event has one
   directions action. Keep the default inline cards for other consumers.
5. Verify that fragment targets exist, browser Back works, and the combined
   story, schedule, venue and closing sections remain keyboard accessible.
   If PR #6 has landed, use its cover first and keep the quick links in flow
   immediately after it. Preserve its schedule jump only if QuickLinks does
   not already supply the same action.
