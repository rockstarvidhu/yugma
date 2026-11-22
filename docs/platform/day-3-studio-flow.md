# Customer Studio

A signed-in customer opens `/studio` to see owned drafts. `/create/afterglow` checks the registered design and the database draft-eligibility flag, then calls `POST /api/drafts`. `/studio/[id]` loads an owned draft on the server. The draft editor has no local storage, client database writes, upload, or publishing path.

The merged Day 3 API gives PATCH merge semantics. The editor uses PUT with the complete canonical snapshot and last acknowledged version so deleted ceremonies and cleared fields are actually removed. GET is used to reload a conflicting draft only after the customer confirms discarding unsaved edits. A response with a newer confirmed version updates the local baseline. The server returns only owned drafts and private, no-store responses.

Wedding date and time are stored on the ceremony. Studio interprets edited dates in the chosen IANA timezone, rejects skipped times, and picks the earlier occurrence for newly entered repeated times. Existing timestamps retain their original offset and precision unless the event time is changed. Unedited media data is preserved through a save.

Preview uses the existing registered renderer and demo watermark. Both names, the timezone, and one complete ceremony are needed before preview. It can show that ceremony while other ceremonies are still incomplete. Preview may reflect unsaved edits, and returning to the editor keeps them in memory. Afterglow draft eligibility remains separate from the existing optional Test Mode checkout.

## Manual check

With a configured disposable account, sign in, open Studio, start an Afterglow draft, edit names and one ceremony, save, then return to the dashboard and reopen the draft. Check that the editor restores the saved values and Preview shows the watermark. Open the same draft in two sessions, save in one, and verify the other keeps its input on conflict until the customer explicitly reloads the saved copy.
