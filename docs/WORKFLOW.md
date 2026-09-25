# Workflow

## Branches

This is a one-hour hackathon. Everyone pushes to `main`. Folder ownership, not branching, prevents conflicts.

```bash
git pull --rebase && npm run build && git push
```

Run that before every push. If `main` goes red, Core reverts the commit immediately and the author fixes it locally.

The branches `develop`, `feature/core-engine`, `feature/iphone`, and `feature/cosmos` exist on the remote from the original 24-hour plan. Ignore them unless the hackathon length changes.

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

- The core lane ships the mock experience and the contract in the first ten minutes. Both experience lanes write their JSON data during that window, then build against the mock's `SceneContext`.
- Each lane registers its experience with one line in `src/experiences/index.ts` and can see it in the real app immediately. No separate harness.
- Pull before every push. Ten minutes without pulling is too long.

## Commits

Small commits, present tense, one change each. Push every time something works.

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
