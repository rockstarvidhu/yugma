# Private drafts for Studio

The Studio editor consumes same-origin JSON from the Next.js App Router. Shared types are exported from `src/lib/drafts/contract.ts`. The request handlers are in `src/app/api/drafts/route.ts` and `src/app/api/drafts/[id]/route.ts`.

| Method and path         | Request                        | Success                             |
| ----------------------- | ------------------------------ | ----------------------------------- |
| `POST /api/drafts`      | `CreateDraftRequest`           | `201` with `{ draft }`              |
| `GET /api/drafts`       | Optional `?after=<nextCursor>` | `200` with `{ drafts, nextCursor }` |
| `GET /api/drafts/:id`   | Draft UUID                     | `200` with `{ draft }`              |
| `PATCH /api/drafts/:id` | `SaveDraftRequest`             | `200` with `{ draft }`              |
| `PUT /api/drafts/:id`   | `SaveDraftRequest`             | `200` with `{ draft }`              |

Every call uses the existing `/sign-in` session cookie. In Studio, use same-origin `fetch` with `Content-Type: application/json` on writes. The server checks the current Supabase Auth user on each call and excludes Supabase anonymous accounts. Responses use `Cache-Control: private, no-store`. The list returns up to 20 owned drafts in UUID order. Send its `nextCursor` as `after` until it returns `null`.

Each `Draft` contains `id` (UUID), `templateKey` (registry key), `templateId` (database UUID), `data` (canonical draft shape), `schemaVersion`, `version`, and `updatedAt` (ISO timestamp). It contains no owner, publication, or payment fields.

## Create, read and save

Create with the registry key. Afterglow accepts private drafts while its catalogue row remains demo-only and unpriced.

```http
POST /api/drafts
Content-Type: application/json

{"templateKey":"afterglow","schemaVersion":1,"data":{}}
```

Read the returned UUID after navigation or reload.

```http
GET /api/drafts/e1000000-0000-4000-8000-000000000001
```

Send changed fields with `PATCH` and include the last acknowledged version. Omitted fields retain their saved values. Couple and venue fields merge individually. Events are matched by stable ID. Untouched events retain their order and new events are appended in request order. An explicit `events: []` clears the list. Other arrays and complete images replace the supplied field.

```http
PATCH /api/drafts/e1000000-0000-4000-8000-000000000001
Content-Type: application/json

{"schemaVersion":1,"expectedVersion":1,"data":{"couple":{"partnerOne":"Tara"},"events":[{"id":"ceremony","venue":{"name":"Sample Venue"}}]}}
```

Use `PUT` for a complete snapshot, including when removing or reordering individual events or removing a field without a blank value. A field omitted from a PUT snapshot is removed. PUT preserves server-managed metadata and uses the same version check as PATCH. The merged result of PATCH is validated against the same schema and size limit as the PUT snapshot.

Drafts start at version 1. Use the version returned by the server for the next save. Schema version 1 is independent of the save counter. Drafts may omit any root field, use incomplete couples or venues, and contain zero events. Each included event needs a stable unique ID. Omit blank required-at-publication fields until they have a value. Present values inherit canonical limits and validators, including URL, timezone, timestamp, and media rules. An included image still needs its URL and alt text. Media binaries are outside this API. The UTF-8 serialized `data` limit is 128 KiB. The complete request has an extra 1 KiB for its envelope.

Use an IANA timezone such as `Europe/London` and send each event as an ISO timestamp with an offset or `Z`. Resolve wall-clock input in the editor, including skipped and repeated DST times. Blank optional text such as `welcomeNote` clears the field. The schema does not accept JSON `null`. If a venue changes and the saved `mapsUrl` is obsolete, replace that URL or remove it via PUT.

## Errors

| Status | `error.code`        | Studio handling                                             |
| ------ | ------------------- | ----------------------------------------------------------- |
| 400    | `INVALID_DRAFT`     | Correct invalid PUT/PATCH JSON or field issues.             |
| 401    | `UNAUTHENTICATED`   | Prompt for sign-in and keep unsaved edits in memory.        |
| 404    | `DRAFT_NOT_FOUND`   | Show a generic unavailable draft message.                   |
| 409    | `VERSION_CONFLICT`  | Preserve unsaved edits and offer to reload the server copy. |
| 413    | `PAYLOAD_TOO_LARGE` | Ask the user to shorten the draft.                          |
| 422    | `INVALID_DRAFT`     | Correct invalid POST data or an invalid list cursor.        |
| 500    | `INTERNAL_ERROR`    | Keep local edits and provide a retry.                       |

Validation errors may contain `issues: [{ path, message }]`. Draft text containing a NUL character or an unpaired UTF-16 surrogate is rejected with the field path. Valid Unicode and emoji are accepted. A rejected write preserves the stored draft and its version. The API discloses the current version only to the owner.

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The draft version has changed. Reload it before saving again.",
    "currentVersion": 2
  }
}
```

On a conflict, retain the local edits and GET the latest draft. Let the user reconcile changes before retrying with the version returned by GET. Using the conflict response version with an old PUT snapshot can discard someone else's edit. Associate in-flight requests with the draft UUID and save attempt so that a late response from a previous save or route cannot replace the active editor state.

## Configuration and verification

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` in an ignored local environment file. Use a disposable Supabase project and its `sb_publishable_` and `sb_secret_` keys. Do not add a `NEXT_PUBLIC_` prefix to the secret. Apply pending migrations in filename order using the project's approved migration workflow, provision two confirmed password accounts, then use `npm ci` and `npm run dev`. Public demo routes require no Supabase configuration.

Reads use the caller's client with owner filters and the existing RLS policies. The migration revokes direct authenticated write grants. Only the server-side service role can call the two invoker functions, which use a fixed search path. The server validates payloads and supplies the authenticated owner ID. The create function checks draft eligibility in the same statement. The save function matches owner, draft ID, draft state, schema version and save version in one atomic update. The existing trigger increments the version once. The server-only Supabase secret is privileged and belongs in the runtime secret store.

`npm run test` runs the draft HTTP contract tests. The database CI job applies all migrations to disposable PostgreSQL with fixture Auth roles, runs `supabase/tests/auth_drafts.sql`, and exports and restores a sample draft in a second disposable database. The authorization fixtures roll back.

On November 20, staging passed the database assertions and the built app passed hosted sign-in, create, list, load, save, logout, and cross-account isolation with two disposable users. Concurrent saves produced one successful write and one `409`. Escaped NUL and lone surrogates produced `422` without changing stored data or version. Valid Unicode and emoji persisted. The test users and their drafts were removed.

The first two migrations were applied to staging through the SQL Editor. Reconcile migration history against versions `20261119000000` and `20261120000000` and confirm the checkout migration state before an automated migration push.
