# Canonical invitation contract

Import `invitationSchema`, `weddingEventSchema`, and `weddingVenueSchema` from
`@/lib/invitation-schema`. These existing runtime entry points remain supported.
Import `Invitation`, `WeddingEvent`, `WeddingVenue`, `Partner`, `Couple`,
`InvitationImage`, and `FocalPosition` from `@/types/invitation` (or the schema
module). All are inferred with `z.infer`; there is no independent model definition.
`InvitationInput` is the pre-normalization form-input type. Parse untrusted input
before passing the resulting `Invitation` to a renderer. `ValidatedInvitation`
is replaced by the canonical `Invitation` export.

## Events and time

An invitation has 1–5 events (`MAX_EVENTS = 5`), a deliberate current product cap
for the initial demo. This cap is not a religious or cultural assumption; review
it explicitly if the product needs larger celebrations. Ceremony titles are free
text. Partners are gender-neutral display-name strings, each up to 80 characters.

Each event requires a non-empty, trimmed ID up to 100 characters, unique within
its invitation. Assign persistent opaque identifiers when creating events (for
example, UUIDs); never derive them from position or title. IDs survive reordering
and renaming. Validation cannot prove how a producer generated an identifier.

`timeZone` is a required IANA zone recognized by the JavaScript runtime, such as
`Asia/Kolkata`, `America/New_York`, `Europe/London`, or `UTC`. Bare numeric zones
are rejected. There are no event-specific overrides in this version.
`startsAt` is an ISO datetime with an explicit offset or `Z`, identifying an
absolute instant. The invitation timezone controls display, not timestamp
acceptance. Equivalent UTC and offset representations are both valid; an offset
need not equal the display zone's offset. Format via `Intl.DateTimeFormat` with
the invitation's zone, including daylight saving at that instant. Invalid dates,
missing offsets, invalid hours and malformed strings are rejected.
The legacy `INVITATION_TIME_ZONE` export is deprecated and is not a validator
restriction or an implicit default.

## Optional images and text

`coverImage` is an optional image object; `gallery` is an optional array of 0–20
image objects (`MAX_GALLERY_IMAGES = 20`). Both may be absent. Each image contains
`src` (absolute HTTP/HTTPS URL, at most 2048 characters), required descriptive
`alt` (1–240 characters), optional `caption` (up to 500 characters), and optional
`focalPosition: { x, y }` with normalized coordinates from 0 to 1 inclusive.
The focal position is content metadata; crop style and animation belong to UI.
There can be one cover plus up to 20 gallery images. Schema checks URL syntax,
protocol and credentials, not remote availability, image content or server-side
fetch safety. Map URLs follow the same URL policy. Usernames/passwords and
javascript/data/file URLs are rejected.

Blank/whitespace-only welcome notes, dress codes and captions normalize to
`undefined`. Required strings remain non-empty. Optional objects/arrays should be
omitted rather than sent as empty strings or null. Welcome text is limited to 500
characters, dress codes to 100, and hosts to 10 names of up to 80 characters.

## Migration and fixtures

Existing couple, event, venue and runtime schema export names are retained.
Producers must now supply `timeZone` and stable event IDs. Replace a legacy
`coverImage` URL string with `{ src, alt }`, or omit it. Supplying a URL alone
cannot satisfy the new descriptive-alt requirement and is intentionally rejected.
The fictional exported demo fixtures contain zero images and no broken remote
placeholders. Applications can add their own licensed photographs using the
optional image model; no image service is required to render the fixtures.

## Heirloom cover

Heirloom resolves cover photos before passing them to the Next.js image
optimizer. The existing demo URL maps to a bundled copy of the licensed photo
by Sabesh Photography LTD. The browser and optimizer only use the local copy.
There is no configured customer image storage or upload pipeline. Other URLs
may pass canonical validation, but Heirloom treats them as unavailable and
does not fetch them or forward them to the browser. Customer photos would
need to be ingested into trusted storage and explicitly supported by this
resolver before they can appear on the cover. A missing, unsupported, or
failed photo leaves the cover's gradient, text, and details link in place.

The schema has no primary event field and event titles are free text. Heirloom
shows the first start by absolute time in the invitation's timezone. When
there is more than one event, it labels that date as the beginning of the
celebrations. Reordering events has no effect on this date.
