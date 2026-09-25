# Workflow

## Branches, worktrees, and PRs

Everything reaches `main` through a pull request. No CI checks, no required reviewers. You open the PR, you confirm `npm run build` passed locally, you merge it yourself. The PR is for visibility and a clean revert point, not for gating.

Each developer works in a git worktree on their own branch so `main` stays checked out and clean for pulling.

| Who | Branch | Worktree |
| --- | --- | --- |
| Shiv | `feature/core-engine` | `../4sight-core` |
| Arjun | `feature/iphone` | `../4sight-iphone` |
| Junaid | `feature/cosmos` | `../4sight-cosmos` |

Set up once, from inside the clone:

```bash
git fetch origin
git worktree add ../4sight-iphone feature/iphone   # use your own branch and path
cd ../4sight-iphone && npm install
```

Ship a change:

```bash
git fetch origin && git rebase origin/main
npm run build
git push -u origin feature/iphone
gh pr create --base main --fill
gh pr merge --squash --delete-branch=false
```

Merge your own PR the moment the build is green locally. Then everyone else rebases. Small PRs, many of them. A PR that sits for ten minutes is stale.

The `develop` branch exists from the 24-hour plan. Ignore it.

The only workflow in `.github/workflows/` is `deploy.yml`. It publishes `main` to GitHub Pages. It is a deploy step, not a check. Nothing blocks a merge.

## Ownership

| Path | Owner | Others may |
| --- | --- | --- |
| `src/core/types.ts` | everyone in the first ten minutes, frozen after | propose changes in chat |
| `src/core/`, `src/renderer/`, `src/ui/`, `src/app/` | Shiv | message first |
| `src/experiences/iphone/`, `src/interaction/` | Arjun | read |
| `src/experiences/solar-system/` | Junaid | read |
| `src/experiences/index.ts` (the registry) | Shiv | add one import line for your experience |
| `public/data/iphone.json` | Arjun | read |
| `public/data/solar-system.json` | Junaid | read |
| `vite.config.ts`, `.github/workflows/` | Shiv | read |

The registry file is the only shared write point. Each lane adds exactly one line to it during Phase 3. Everything else an experience needs lives inside its own folder.

## Staying unblocked

- Shiv ships the mock experience and the contract in the first ten minutes. Arjun and Junaid write their JSON data during that window, then build against the mock's `SceneContext`.
- Each lane registers its experience with one line in `src/experiences/index.ts` and can see it in the real app immediately. No separate harness.
- Rebase on `origin/main` before every PR. Ten minutes without rebasing is too long.

## Commits

Small commits, present tense, one change each. Open a PR every time something works.

## Local commands

```bash
npm install
npm run dev        # http://localhost:5173/4sight/
npm run build
npm run preview    # serves dist/ at the GitHub Pages base path
npm run typecheck  # tsc --noEmit, run before every push
```

## Deployment

Every merge to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. This is the only automation in the repo. The public URL is https://shivaswaroop40.github.io/4sight/. GitHub Pages is configured to deploy from GitHub Actions, so no `gh-pages` branch exists.

The Vite base path is `/4sight/`. Every asset URL is built from `import.meta.env.BASE_URL`, never from a leading slash. If the repository is renamed, change `base` in `vite.config.ts` and nothing else.
