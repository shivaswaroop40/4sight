# 4sight

Time is the fourth dimension. 4sight is an interactive 3D explorer where every scene is a function of time: `getState(t)`. Scrub, play forward, play backward, warp time, and the world reconstructs itself at any instant.

Three experiences, one time engine:

| Experience | Time span | What you see |
| --- | --- | --- |
| iPhone | seconds | components fly together from a disassembled cloud into an assembled phone |
| Galaxy | hundreds of millions of years | a gas cloud collapses, ignites, and settles into a spiral galaxy |
| Big Bang | 13.8 billion years | the universe from inflation to today on a logarithmic timeline |

Live site (after the first deploy): https://shivaswaroop40.github.io/4sight/

## Status

Planning complete for a 60-minute hackathon. No application code yet. Start with [docs/PLAN.md](docs/PLAN.md).

## Documents

- [docs/PLAN.md](docs/PLAN.md). End-to-end build plan, phases, ownership, demo script, definition of done.
- [docs/CONTRACT.md](docs/CONTRACT.md). The shared TypeScript contract every experience implements. Frozen after Phase 1.
- [docs/WORKFLOW.md](docs/WORKFLOW.md). Branches, ownership boundaries, merge order, local commands.

## Stack

React, TypeScript, Vite, Three.js. Fully client-side. Deployed to GitHub Pages by GitHub Actions on every push to `main`.

## Team

Three developers, three lanes, one contract.

| Lane | Owns | Who |
| --- | --- | --- |
| Core engine, renderer, UI | `src/core/`, `src/renderer/`, `src/ui/`, `src/app/` | the repo owner |
| iPhone and interaction | `src/experiences/iphone/`, `src/interaction/` | whoever is left |
| Galaxy and universe | `src/experiences/galaxy/`, `src/experiences/universe/`, `src/experiences/shared/` | whoever knows Three.js |

Everyone pushes to `main`. See [docs/WORKFLOW.md](docs/WORKFLOW.md).
