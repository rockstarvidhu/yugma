# YUGMA brand foundations

## Source and fidelity

Assets were imported from `YUGMA_Production_Brand_Assets.zip`, using its
`ready-for-nextjs/public/brand/` bundle. SVG geometry and imported file bytes are
unchanged. The archive itself and duplicate raster logos are not included.
The supplier describes the vectors as reconstructions of the selected concepts,
not mathematically identical copies of the original brand board. This integration
does not redesign them. The original board was not included for comparison.

## Palette and tokens

| Colour | Value | Corporate role |
| --- | --- | --- |
| Forest | `#2E3A2F` | Headings, text, primary controls |
| Sand | `#EDE7DB` | Backgrounds, text on forest |
| Sage | `#A7B097` | Dividers, supporting surfaces |
| Terracotta | `#A7684F` | Decorative accents |
| Charcoal | `#1F1F1F` | Body text |

`src/app/globals.css` defines immutable `--yugma-*` palette variables and Tailwind
v4 colour mappings. Corporate surfaces opt in with `className="yugma-brand"`.
Inside this scope, use `bg-background`, `text-foreground`, `text-heading`,
`text-muted`, `border-border`, `bg-primary`, `text-on-primary`, and `text-accent`.
Avoid sage or terracotta for small text on sand; the primary text pairing is
forest/charcoal on sand. Keyboard focus uses an offset outline.

Invitation templates own their palettes, fonts and semantic variables. Do not
wrap them in `yugma-brand` or make corporate colours universal body defaults.
They may define the same semantic variables within their own theme scope.

## Typography

Inter is the body/interface font (`font-sans`); Playfair Display is editorial
(`font-editorial`). Both are variable fonts loaded with `next/font/google`, Latin
subsets and `display: swap`. Google access is required at build time; the resulting
font files are self-hosted. Use the supplied SVG wordmark for logos, never text.

## Assets

`public/brand/` contains forest, sand, white and charcoal wordmarks/emblems;
forest, sand and white horizontal/stacked lockups; the inline-use currentColor
emblem; favicon SVG/ICO, Apple touch icon, manifest, standard and maskable app
icons, and the 1200×630 corporate Open Graph PNG.

Use forest on light surfaces and sand/white on forest. Preserve viewBox ratios:
wordmark 1832:436, emblem 763:969, horizontal lockup 1400:350, stacked 1100:650.
Do not stretch, crop, recolour, filter or modify logo paths. Logo SVGs are
transparent, self-contained path geometry. The favicon intentionally has a
background. The currentColor variant is for inline SVG use, not an image whose
colour is expected to inherit from surrounding HTML.

## Components

- `components/brand/BrandLogo`: `variant="wordmark" | "emblem"`,
  `tone="forest" | "sand" | "white"`, optional `href`, `label`, `priority`,
  and `className`. Width responds to the viewport and height preserves the SVG
  ratio. Use `href="/" label="YUGMA home"` for home navigation. Use
  `decorative` only without a link; TypeScript forbids decorative linked logos.
- `components/ui/Button`: native button props/ref, primary/secondary/ghost
  variants, disabled and focus states, minimum 44px height. Defaults to
  `type="button"`; opt into `submit` for forms. Use links for navigation.
  Interactive event handlers must be supplied from a Client Component.
- `components/ui/Container`: consistent max-width and responsive horizontal padding.
- `components/ui/SectionHeading`: title, optional eyebrow/children, heading level
  (`as`), heading `id`, and left/center alignment. Keep a logical document outline.

## Preview and metadata

Run `npm run dev` and visit `/dev/brand`. This page returns 404 outside development
and includes noindex/nofollow metadata. Inspect at 375px and 1440px, including
keyboard focus, disabled controls, all logo tones, lockups and image loading.
The homepage is only an identity placeholder, not a marketing implementation.

Root metadata owns icons and the manifest. Corporate Open Graph/Twitter metadata
is defined on the homepage so future invitations do not inherit its artwork.
Invitation routes should export their own title, description, Open Graph and
Twitter images (use `title: { absolute: ... }` to bypass the corporate title
suffix). No root file-based OG image overrides invitation metadata.

Set the server-side `SITE_URL` to the final absolute public origin in deployment.
The Vercel production URL is used when available; localhost:3000 is the local
fallback. Never deploy another host with the localhost fallback. No production
domain was supplied, so none is invented here. Manifest icon URLs are absolute
paths under `/brand/` and preserve the supplier's maskable variants.

## Validation

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`. No existing test runner
was configured in the initial project. After building, run `npm start` and confirm
`/dev/brand` returns 404, `/` includes icon/manifest/social tags and all `/brand/`
resources resolve. Check the generated social URL against the deployment origin.
