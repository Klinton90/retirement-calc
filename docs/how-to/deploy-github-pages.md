# Deploy to GitHub Pages

RetireSmart is a Vite SPA. GitHub Pages must serve the **built** `dist/` folder, not the repo-root `index.html` (that file still points at `/src/main.tsx` and only works under `npm run dev`).

## How it works

1. Push to `master` (or run the workflow manually).
2. GitHub Actions runs `npm ci` → `npm run build` → uploads `dist/`.
3. Pages publishes the artifact to:
   `https://klinton90.github.io/retirement-calc/`

Workflow: [`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml).

`vite.config.ts` sets `base: '/retirement-calc/'` when `GITHUB_ACTIONS` is set (or when `GITHUB_PAGES_BASE` is overridden). Local `npm run dev` keeps `base: '/'`.

## One-time GitHub setup

1. Repo **Settings → Pages → Build and deployment → Source**: **GitHub Actions**.
2. Ensure the repo is public (or your plan allows Pages on private repos).

No local git hooks are required — build + deploy happen on GitHub after each push.
