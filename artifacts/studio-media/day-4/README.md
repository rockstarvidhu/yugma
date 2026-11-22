# Studio private media browser evidence

Playwright drove Chrome 157.0.8103.79 against the production Next.js server. The walkthrough used disposable PostgreSQL with the repository migrations and RLS tests, a local Supabase Auth/PostgREST transport, and a separate-origin signed R2 transport fixture. The uploaded image is the repository's existing demo photo. All account and invitation details are fictional.

| Viewport   | Recording                            | Screenshots                                                                |
| ---------- | ------------------------------------ | -------------------------------------------------------------------------- |
| 320 × 568  | [Walkthrough](studio-cover-320.webm) |                                                                            |
| 390 × 844  | [Walkthrough](studio-cover-390.webm) | [Studio](studio-cover-390.png), [private preview](private-preview-390.png) |
| 768 × 1024 | 26.76 s                              | [Walkthrough](studio-cover-768.webm)                                       |                                                                              |
| 1440 × 900 | 26.80 s                              | [Walkthrough](studio-cover-1440.webm)                                      | [Studio](studio-cover-1440.png), [private preview](private-preview-1440.png) |

Each walkthrough covers sign-in, draft creation, upload, versioned save, reload, private preview, and both public demo routes. The three smaller viewports use touch emulation, with keyboard focus also checked. The desktop flow uses keyboard activation. The 390 px recording adds an injected storage failure and an upload cancellation. Its single HTTP 503 and matching console entry are expected from that test. The successful journeys had no console errors, network failures or horizontal overflow.

[Detailed validation results](validation.json) include ownership checks, signature and expiry enforcement, duplicate completion, and concurrent saves. Hosted Supabase and Cloudflare R2 were unavailable for this run. Confirm actual Cloudflare CORS, signed PUT, conditional writes and the hosted read path before enabling uploads. [Deployment and API instructions](../../../docs/platform/private-draft-media.md)
