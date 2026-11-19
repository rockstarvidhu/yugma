# YUGMA Day 1 — homepage foundation

19 November 2026 · Developer A · `feat/home-collection`

## Baseline and scope

Created in an isolated managed worktree from `origin/main` commit `1ca685f5adb28ac5a1badccd813043788db75e78` (PR #11). The cinematic checkout stays on `spike/thread-between-us-v2` at `b74d118078d9e7e79722a9952ab93b29930be1a5`, clean and unchanged. No cinematic commit is in this branch.

Baseline: Next.js App Router 16.4.3, React 19.3, strict TypeScript, npm lockfile, Tailwind v4 via Turbopack, Playfair Display/Inter, shared brand/UI components, canonical Zod-derived Invitation schema, one Afterglow registry entry, two concrete demo routes using that same template, shared watermark and temporary preview customization. Root icons/manifest and route-scoped corporate sharing metadata already existed. No new dependency, shared schema, registry, root layout, global token, demo, payment, auth or backend change.

Day 1 delivers: responsive official-brand header/footer; keyboard-friendly mobile disclosure with Escape and outside-click cleanup; editorial hero using owner-approved temporary hands photograph; real section/demo CTA targets; registry-backed single-template collection scaffold; truthful How It Works and final CTA; page metadata; versioned proposed route/catalogue contract. Carousel and `/templates` are Day 2 work on the same branch.

## Actual validation

- `npm ci`: passed using the unchanged committed lockfile. Reported **8 moderate audit findings** and an ESLint version deprecation; no forced fixes or dependency changes were attempted.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `npm run typecheck`: passed.
- `npm run test`: **163 tests across 9 files passed**, including 7 new storefront tests. The existing brand-home assertion now expects the real hero heading while retaining official identity/metadata checks.
- `npm exec -- vitest list --filesOnly`: all 9 intended suites found, including `tests/event-timeline.test.tsx` and the new storefront suite. Discovery and CI configuration remain unchanged.
- `npm run build`: passed on retry. First attempt compiled and prerendered successfully, then Next.js stopped to display its existing security advisory; retry completed with the warning. The Next.js advisory remains a separate release/security concern.

Real installed Google Chrome tested the **production build** (`next start`, port 3151) at 320×568, 375×667, 390×844, 430×932, 768×1024 and 1440×1000. All passed:

- zero horizontal overflow;
- one h1 and valid CTA paths/section IDs;
- responsive mobile/desktop navigation, keyboard skip, visible focus, Enter/Tab/Escape behavior, touch activation and menu closure;
- sticky-header-safe collection anchor placement and browser Back between anchors;
- loaded hero and other image assets, actual Playfair Display/Inter computed families;
- joined-hands source region remains inside the cover crop at every tested width;
- no recorded console or hydration errors;
- measured CLS 0 in this local run.

Both `/demo/heirloom` and `/demo/afterglow` passed production regression at 320 and 1440: immediate sample, invalid-input validation, valid personalization, reset, reload, visible watermark and no horizontal overflow. Homepage header remains absent from invitation routes. Reduced-motion transitions were disabled. With JavaScript disabled, core page content and footer navigation remain available; the enhanced mobile disclosure requires JavaScript.

Full machine-readable evidence is in `browser-results.json`. These checks used desktop Chrome's viewport/touch emulation. Physical iOS/Android hardware, Safari, assistive-technology speech output and field performance were not tested. CLS is a local measurement, not a field guarantee.

## Screenshots

Actual production-browser screenshots. The first three captures include the earlier temporary hero. This redesign preserves them in an ignored local evidence folder and removes them from the current tracked tree. Historic commits still contain the earlier captures.

- `01-home-desktop-1440.png` — full desktop page.
- `02-home-mobile-390.png` — full mobile page.
- `03-home-mobile-320.png` — full narrow mobile page.
- `04-header-mobile-menu.png` — expanded mobile disclosure.
- `05-template-section-scaffold.png` — actual single-template collection.
- `06-footer-mobile.png` — contact availability notice and footer navigation.

## Reproduce

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
npm run start -- --hostname 127.0.0.1 --port 3151
```

In another terminal, with optional external Playwright available:

```sh
PLAYWRIGHT_MODULE=/tmp/yugma-thread-browser/node_modules/playwright node scripts/verify-home-collection.mjs
```

Override `PREVIEW_URL`, `CHROME_PATH` or `PLAYWRIGHT_MODULE` for another local environment. Playwright is not added to the project's package manifest. The runner exits on failure and writes its JSON result only after all checks pass. Screenshots are actual captures, with Next's development toolbar hidden when present.

## Outstanding review and release gates

- Hero is explicitly owner-approved **temporarily**; confirm storefront rights or replace with higher-resolution licensed/owned photography before public release. See `docs/storefront/assets.md`.
- Contract v0.1 is **proposed**, not yet independently agreed by Developer B (`SooryaDayal`). No agreement is claimed. Review questions and frontend/backend ownership boundaries are in `docs/storefront/route-catalogue-contract-v0.1.md`.
- No verified public contact email/URL was supplied. Contact navigation reaches a real availability section; no fake address, email or profile is shown. A live enquiries channel remains pending.
- Prices, purchase, creation, publication and checkout are unavailable. Both demo routes currently represent the same registered design.
- GitHub CLI and the inspected Chrome GitHub session are signed out. Draft PR creation/reviewer assignment requires authenticated GitHub access; the prepared PR description is `docs/storefront/day-1-pr.md`. The final task report records the actual push outcome.
- Keep the branch open for Day 2 carousel/catalogue work and Developer B review. Do not merge this Day 1 slice.
