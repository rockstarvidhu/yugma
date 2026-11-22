# Private Studio cover photos

Upload is available for authenticated, draft-eligible invitations. Studio writes only the canonical optional cover image and its description. Private gallery uploads and public publishing are outside this flow.

## Deploy

Apply the Supabase migrations in order. Create a Cloudflare R2 bucket with public access, the `r2.dev` URL, and custom domains disabled. Use a dedicated S3 API token restricted to Object Read & Write on that bucket. Configure the server-only `R2_ACCOUNT_ID`, `R2_PRIVATE_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` alongside the existing Supabase environment. Use the standard R2 S3 endpoint for this configuration. Keep credentials out of browser variables, source and request logs.

Allow only actual Studio origins in the bucket CORS policy. For example, substitute the real authorized staging origin:

```json
[
  {
    "AllowedOrigins": ["https://studio-staging.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "If-None-Match", "Content-Length"],
    "MaxAgeSeconds": 300
  }
]
```

The browser sets the length when sending the file bytes. The app sends the signed content type and `If-None-Match: *`. Studio reads private photos through its own origin. Staging and production must each verify their exact origin and browser PUT preflight on the actual bucket.

Set a one-day R2 object lifecycle expiration for the `incoming/` prefix. Successful and rejected uploads leave their staging keys occupied past the signed grant's expiry, so the write-once header continues to protect the key. Do not add a blanket expiration for the `draft-media/` prefix. Each new upload attempts to remove up to five abandoned objects on that draft after a one-hour grace period beyond reservation expiration. Interrupted final registration on an inactive draft can leave an orphan in `draft-media/`. For operational cleanup, use a privileged inventory against reservations and registered assets, and remove only unregistered keys with expired reservations beyond the grace period. A PostgreSQL backup contains photo references and metadata. Recovery also requires an authorized backup of the corresponding R2 objects. Replacement and removal preserve verified objects for versioned draft editing. Five verified objects exhaust the draft's quota until a future owner-safe deletion flow exists.

## Studio API

| Request                                                                 | Successful response                   | Behavior                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/drafts/:id/media` with `{"type":"image/jpeg","bytes":12345}` | `201 {"assetId":"…","uploadUrl":"…"}` | Authenticates and checks draft ownership and eligibility. Reserves a random ID and returns a 90-second PUT grant scoped to one write-once object, MIME type and byte count.                          |
| `POST /api/drafts/:id/media/:assetId` with an empty JSON object         | `200 {"assetId":"…"}`                 | Verifies storage metadata, actual length, signature and single-frame decoding. Normalizes and registers an immutable object under the same draft and owner. Repeated completion returns the same ID. |
| `GET /api/drafts/:id/media/:assetId`                                    | `200 image/webp`                      | Re-verifies the session, draft and registered asset. The server uses a 30-second R2 grant and streams a private, no-store response without redirecting.                                              |
| `PUT /api/drafts/:id` using the existing versioned payload              | `200 {"draft":{…}}`                   | Stores the authorized cover image reference. The draft write transaction rejects an attachment from any other draft or owner.                                                                        |

The stored `https://media.yugma.invalid/<assetId>` value is an opaque reference. Studio resolves it to its authenticated endpoint. Demo and public rendering cannot resolve it directly. No signed GET URL or R2 API credential is returned to the browser. Never put the PUT grant in analytics or troubleshooting logs.

The API uses `401` for missing sessions, `404` for invalid or inaccessible IDs, `409` for an object that hasn't arrived, `410` for an expired reservation, `422` for invalid media, `429` for quota limits and `502`/`503` for transport or configuration failures. Draft writes continue to use the existing optimistic version contract.

JPEG, PNG and WebP are limited to 5 MiB and 20 megapixels. The server normalizes to WebP with a maximum edge of 2400 pixels and strips original metadata. SVG, mislabeled files, animated images and files that fail to decode are rejected. A draft permits five ready or active reservations combined, up to three pending, and no more than 20 reservations per hour. A reservation remains eligible for completion for ten minutes. Cancelling locally stops the transfer and leaves any unregistered reservation to expiry and cleanup.

This is a private preview boundary. Any future publishing flow needs its own authorization, separate media delivery policy and retention/deletion plan.

## References

- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [Cloudflare R2 S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/)
- [Cloudflare R2 lifecycle rules](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
