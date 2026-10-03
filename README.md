# 4sight

Time is the fourth dimension. 4sight is an interactive 3D explorer where every scene is a function of time: `getState(t)`. Scrub, play forward, play backward, warp time, and the world reconstructs itself at any instant.

Two experiences, one time engine:

| Experience | Time span | What you see |
| --- | --- | --- |
| iPhone | seconds | components fly together from a disassembled cloud into an assembled phone |
| Solar System | 4.6 billion years | a cloud of gas and dust collapses into the Sun and eight planets, on a logarithmic timeline |

Live site: https://shivaswaroop40.github.io/4sight/

## Features

- **Gallery.** The picker at the top (or G) opens every experience as a ladder of timescales, from seconds to billions of years. Each experience downloads only when you pick it.
- **Scrub, play, reverse, warp.** Drag the timeline, play either way, and pick a time warp. Event flags jump to the big moments.
- **One-day clock.** When time is real elapsed time, the readout squeezes the whole span into one day: "If 4.6 billion years fit in one day, now is 5:32:10 pm".
- **Camera views.** Preset views per experience, plus Overview.
- **Follow.** Click or tap a planet or a phone part and the camera stays on it while time runs, scrubs, or tours. Drag to orbit around it; scroll or pinch to zoom. A chip under the top bar names it. Esc, the chip's stop button, a view, or Overview lets go. When the object is hidden at the current time (a planet before it forms), the camera keeps to the spot where it is and the chip says "Hidden now".
- **Guided tour.** Tour (or T) visits every event in order. It glides forward to each one, stops on it, and highlights the card for a reading time sized to its text. Next skips ahead. Esc, Exit, playing, scrubbing, a flag, or picking another experience ends it. The link follows each stop.
- **Filters.** The sliders button in the top bar shows or hides layers of a scene, paused or playing: the gas and dust and the orbit lines in Solar System, an X-ray view of the iPhone that lets you hover the parts inside.
- **Links to a moment.** The address bar follows the experience and the timeline position (`?x=solarSystem&u=0.5`) whenever playback stops. More > Copy link copies the exact moment, even mid-playback. A link opens paused on that frame.

## Status

Core scaffold, time engine, and Pages deploy are live. The iPhone and Solar System experiences are in progress. The visual style is warm, beige, and cartoony, with toon-shaded 3D.

**Start here:** [GETTING_STARTED.md](GETTING_STARTED.md). It has the exact git setup, per-developer agent prompts, and the timeline. Each dev can copy-paste their prompt into Claude Code and let Opus 5.5 rip.

**Details:** [docs/PLAN.md](docs/PLAN.md) (timeline and task lists), [docs/CONTRACT.md](docs/CONTRACT.md) (the shared types), [docs/WORKFLOW.md](docs/WORKFLOW.md) (worktrees and PRs).

## Documents

- [docs/PLAN.md](docs/PLAN.md). End-to-end build plan, phases, ownership, demo script, definition of done.
- [docs/CONTRACT.md](docs/CONTRACT.md). The shared TypeScript contract every experience implements. Frozen after Phase 1.
- [docs/WORKFLOW.md](docs/WORKFLOW.md). Branches, ownership boundaries, merge order, local commands.

## Stack

React, TypeScript, Vite, Three.js. Fully client-side. Deployed to GitHub Pages on every merge to `main`.

## Team

Three developers, three lanes, one contract.

| Lane | Owns | Who |
| --- | --- | --- |
| Core engine, renderer, UI | `src/core/`, `src/renderer/`, `src/ui/`, `src/app/` | Shiv ([@shivaswaroop40](https://github.com/shivaswaroop40)) |
| iPhone and interaction | `src/experiences/iphone/`, `src/interaction/` | Arjun ([@arjun-kodaganur](https://github.com/arjun-kodaganur)) |
| Solar System | `src/experiences/solar-system/` | Junaid ([@JunaidMohsin](https://github.com/JunaidMohsin)) |

Each developer works in a git worktree on their own branch and merges their own PRs to `main`. No CI checks. See [docs/WORKFLOW.md](docs/WORKFLOW.md).
