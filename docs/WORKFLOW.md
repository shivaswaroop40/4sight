# Workflow

## Branches

```text
main               deployable at all times. Every push deploys to GitHub Pages.
develop            integration branch. Feature branches merge here.
feature/core-engine   core, renderer, ui, app shell
feature/iphone        iPhone experience, interaction
feature/cosmos        galaxy, universe, filters
```

Merge to `develop` early and often. Merge `develop` to `main` at milestones only (end of Phase 1, end of Phase 3, end of Phase 4, final). A broken `main` means a broken demo URL.

## Ownership

| Path | Owner | Others may |
| --- | --- | --- |
| `src/core/types.ts` | everyone in Phase 1, frozen after | propose changes in chat |
| `src/core/`, `src/renderer/`, `src/ui/`, `src/app/` | core lane | open a PR with a one-line reason |
| `src/experiences/iphone/`, `src/interaction/` | iPhone lane | read |
| `src/experiences/galaxy/`, `src/experiences/universe/`, `src/filters/` | cosmos lane | read |
| `src/experiences/index.ts` (the registry) | core lane | add one import line for your experience |
| `public/data/<experience>.json` | the experience's lane | read |
| `vite.config.ts`, `.github/workflows/` | core lane | read |

The registry file is the only shared write point. Each lane adds exactly one line to it during Phase 3. Everything else an experience needs lives inside its own folder.

## Staying unblocked

- The core lane ships the mock experience and the contract first. Both experience lanes build against the mock's `SceneContext` and a `TimeController` stub that just calls `setTime` from a slider.
- Each experience folder has its own `dev.tsx` harness that mounts only that experience with a bare slider. You never need the full app to work on your lane.
- Rebase your feature branch on `develop` at least every two hours. Small merges resolve in seconds. A twelve-hour merge costs the demo.

## Commits

Small commits, present tense, one change each. Nothing else matters at a hackathon.

## Local commands

```bash
npm install
npm run dev        # http://localhost:5173/4sight/
npm run build
npm run preview    # serves dist/ at the GitHub Pages base path
npm run typecheck  # tsc --noEmit, run before every push
```

## Deployment

Push to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. The public URL is https://shivaswaroop40.github.io/4sight/. GitHub Pages is configured to deploy from GitHub Actions, so no `gh-pages` branch exists.

The Vite base path is `/4sight/`. Every asset URL is built from `import.meta.env.BASE_URL`, never from a leading slash. If the repository is renamed, change `base` in `vite.config.ts` and nothing else.
