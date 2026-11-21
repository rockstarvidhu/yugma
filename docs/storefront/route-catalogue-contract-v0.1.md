# YUGMA route and catalogue contract — v0.1

Date: 19 November 2026. Frontend owner: Developer A. Backend/review counterpart: `SooryaDayal` (provided by the project owner).

**Status: PROPOSED — Developer B agreement is pending.** The owner approved the proposed route direction in the implementation brief; that does not constitute Developer B's independent agreement. No backend, authentication, database or shared invitation contract is changed. Request Developer B's confirmation during review; record any agreed revisions in a versioned update before implementing backend navigation.

## Day 2 implementation decision

The Day 2 owner decision supersedes the roadmap’s Heirloom product name and the proposed Day 1 values below. Afterglow is the single registry ID and catalogue offering. `/demo/heirloom` remains an alias of the same watermarked sample. The homepage carousel uses two views of that invitation, and `/templates` displays one catalogue entry with sample and personalization links.

The existing server checkout sets the Afterglow Test Mode amount to 89,900 INR paise. The storefront displays that same amount with a Test Mode label. Afterglow remains a demo in the database, eligible for private drafts. Test verification grants no publishing entitlement. The amount is for development and does not establish final commercial pricing. Private draft creation requires Supabase configuration and works independently of Razorpay settings.

The footer links to the project’s public GitHub Issues page for general questions. Public customer policies and a dedicated support channel remain release work.

## Routes and ownership boundaries

| Route                | Current state               | Day 1 use                                                                                       |
| -------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| `/`                  | Implemented homepage        | Corporate storefront shell                                                                      |
| `/#templates`        | Implemented section         | All Explore Templates actions                                                                   |
| `/#how-it-works`     | Implemented section         | Navigation                                                                                      |
| `/#contact`          | Implemented section         | Truthful availability notice; no supplied public contact address                                |
| `/templates`         | Reserved for Day 2          | No link to this route until implemented                                                         |
| `/demo/[slug]`       | Two concrete routes exist   | Use the existing `/demo/afterglow` and `/demo/heirloom`; no generic dynamic route is introduced |
| `/create/[template]` | Proposed/reserved           | Creation destination remains null; no public CTA                                                |
| `/studio/[id]`       | Future private editor       | Developer B owns authorization; no route or link today                                          |
| `/checkout/[id]`     | Future checkout             | No route, payment promise or link today                                                         |
| `/i/[slug]`          | Future published invitation | No publication capability or link today                                                         |

Do not infer a public URL from a template ID. Future destination activation requires an actual implemented route and the corresponding server-side authorization. Demo watermarks and client state never authorize purchases or publishing.

## Catalogue presentation metadata

`src/lib/storefront-catalogue.ts` uses the existing registry's `get(id)` before exposing an entry. Its metadata is not an invitation content model; content remains canonical `Invitation`. The registry and renderer APIs remain unchanged. Navigation destinations live in `src/lib/storefront-routes.ts` so the client header need not import template implementations.

| Field                        | Day 1 value / meaning                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `templateId`                 | `afterglow`, the actual registered ID                                                                                       |
| `paletteLabel` / `moodLabel` | Existing Afterglow presentation labels; no template-specific copy in the generic card                                       |
| `name`                       | Afterglow                                                                                                                   |
| `demoUrl`                    | `/demo/afterglow`                                                                                                           |
| `alternateDemoUrls`          | `/demo/heirloom` — compatibility sample route, not a second product                                                         |
| `personalizeUrl`             | `/demo/afterglow`; Try Your Details remains in the existing shared interface                                                |
| `preview`                    | Existing licensed cover asset `/invitations/heirloom-demo.jpg`, intrinsic dimensions and descriptive alt                    |
| `availability`               | `demo-available`; `in-development` is reserved for explicitly reviewed future metadata, never synthesized from branch names |
| `purchaseAvailable`          | `false`                                                                                                                     |
| `createUrl`                  | `null` until an actual creation entry exists                                                                                |
| `price.currency`             | `INR`                                                                                                                       |
| `price.billing`              | `one-time`                                                                                                                  |
| `price.amountMinor`          | `null`; no price has been approved, and no rupee amount is displayed                                                        |

A missing registered template produces no card or dead demo CTA. Heirloom is currently a photographic cover inside Afterglow. The Thread Between Us remains a local cinematic experiment outside this catalogue and branch. No extra products, placeholder prices or artificial coming-soon cards are introduced.

Before purchase becomes possible, agree the authoritative price source and entitlement checks with Developer B. Frontend metadata will never be payment authority. Availability and create destinations must be updated together with working server routes.

## Review questions for Developer B

1. Confirm the reserved route shapes and that `/create/[template]` is the intended future creation entry.
2. Confirm `afterglow` as the current catalogue ID and the Heirloom route's alias status.
3. Agree the future authoritative INR minor-unit price source and availability contract before activating purchasing.
4. Provide a verified public customer-contact destination before launch.

Day 2 on this same branch: implement `/templates` and the horizontal carousel, then update only the now-working navigation destination. No Day 2 functionality is included in today's change.
