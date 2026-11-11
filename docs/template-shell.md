# Track B template shell

The renderer and registered templates share the canonical Zod-derived
`Invitation` type from Track A. Producers parse data with `invitationSchema`
before handing it to the renderer.

The registry maps stable IDs to independently styled React components. Add a
TemplateDefinition to the registry to add a template; the renderer needs no change.
Duplicate or empty IDs fail during registry construction. Unsupported IDs produce
an accessible unavailable message. Use the lookup result at future dynamic route
boundaries to return a 404 if appropriate. Templates own layout and interaction;
the renderer only selects a component and passes data. No animation dependency is
needed. Afterglow has local CSS and uses existing Playfair Display and Inter fonts.

`/demo/afterglow` renders a fictional invitation parsed by the canonical schema.
The fixture exercises the photo-free path. Afterglow uses the invitation timezone
for event dates and times and omits a missing welcome note.

The demo watermark includes an accessible banner in normal flow and a fixed
decorative badge in the page gutter. Both leave pointer input available to guests.
Publishing access must be authorized on the server.

Future envelope, scroll/floral and gallery effects belong in Afterglow, at its
TODO markers, with reduced-motion and keyboard support. They are out of scope here.
