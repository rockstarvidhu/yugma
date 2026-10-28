# YUGMA

YUGMA is a mobile-first wedding invitation experience. Week 01 builds one
fictional, watermarked Heirloom demo and the reusable foundations around it.
The demo does not publish paid invitations or store visitor details.

## Local setup

Use Node.js 22 and npm. From the repository root, install the pinned dependencies
and start the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To prepare a pull request,
run the same checks used by CI:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Use `npm run format` to apply the repository's Prettier formatting. Add or update
dependencies with npm and commit the resulting `package-lock.json`; CI installs
with `npm ci` so it uses that lockfile exactly.

## Pull requests and branches

Create a short-lived branch from the latest `main` and open a pull request back
to `main`. Do not push directly to `main`. CI runs on pull requests and checks
lint, formatting, TypeScript, unit tests, and the production build. Have the
other teammate review the pull request before merging. Mention changes to shared
contracts, routes, or styles in the pull request description.

## Environment and privacy

No environment variables are required for the local demo. `.env*` files are
ignored by Git. Never commit secrets, actual customer information, or personal
visitor data. If a future feature needs configuration, document variable names
in a secret-free `.env.example` file.

Demo content must remain fictional and visibly marked `YUGMA • DEMO`. The
watermark is not access control, and client-side state must never authorize an
unwatermarked or paid invitation. Week 01 does not include accounts, uploads,
payments, persistent customer data, or paid-service integrations.
