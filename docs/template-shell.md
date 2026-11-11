# Track B template shell

Blocked on Track A PR #3 integration before merge. This branch imports no unmerged
Track A code and defines no permanent Invitation model or runtime schema.

The registry maps stable IDs to independently styled React components. Add a
TemplateDefinition to the registry to add a template; the renderer needs no change.
Duplicate or empty IDs fail during registry construction. Unsupported IDs produce
an accessible unavailable message. Use the lookup result at future dynamic route
boundaries to return a 404 if appropriate. Templates own layout and interaction;
the renderer only selects a component and passes data. No animation dependency is
needed. Afterglow has local CSS and uses existing Playfair Display and Inter fonts.

The only temporary model is internal/temporary-invitation.ts. It is a minimal
rendering fixture, not a validation or storage contract. It deliberately does not
mirror PR #3. Never accept untrusted user data through this temporary boundary.

/demo/afterglow renders fictional content and a reusable watermark. Its top banner
is in normal flow; the narrow fixed badge sits in the right-hand page gutter, repeating the mark
in screenshots without covering content or capturing pointer input.
The repeated badge is hidden from assistive technology; the accessible banner identifies the demo.
Watermark visibility provides no purchase authorization. Future production access
must be server-authorized, with no client-side paid flag.

## After Track A merges

1. Integrate latest main safely and inspect the final canonical exported contract.
2. Replace TemporaryInvitation in templates/types.ts with the canonical Invitation
   import, keeping InvitationTemplateProps = { invitation: Invitation }.
3. Delete internal/temporary-invitation.ts. Rewrite internal/demo-invitation.ts to
   use fictional canonical data parsed by invitationSchema; do not cast it.
4. Update Afterglow field access to the finalized couple, welcome, event and venue
   fields. Use stable event IDs and the canonical timezone semantics. Render missing
   optional messages/images safely. Do not add a second adapter schema or model.
5. Update renderer fixtures/tests to use validated canonical data and cover absent
   optional content, long names, multiple events and timezone display.
6. Run npm ci, lint, format:check, typecheck, test and build, and verify production
   desktop/mobile rendering. Request review and remove the draft/blocker only after
   integration succeeds. Do not merge without explicit approval.

Future envelope, scroll/floral and gallery effects belong in Afterglow, at its
TODO markers, with reduced-motion and keyboard support. They are out of scope here.
