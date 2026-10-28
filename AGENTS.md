<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## YUGMA project guardrails

- Read the relevant Next.js guide under `node_modules/next/dist/docs/` before changing Next.js APIs or conventions. Preserve the generated rules above.
- Use TypeScript strict mode and the existing shared contracts. Discuss changes to shared routes, styles, or data contracts before editing them in parallel.
- Do not add a package without a clear need. Keep Week 01 free of paid-service integrations.
- Never commit secrets, real customer data, or `.env` files. `.env*` files are ignored; use `.env.example` only for documented, non-secret variable names.
- Keep preview data fictional and client-side. Do not treat a client-side flag or demo watermark as purchase authorization.
- Before opening a pull request, run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run format:check`, and `npm run build`.
- Work on short-lived branches from the latest `main`; do not push directly to `main`. Have the other teammate review each pull request before merge.
