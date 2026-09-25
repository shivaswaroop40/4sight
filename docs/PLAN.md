# 4sight build plan (60 minutes)

One time engine drives three worlds. A judge opens the site, sees an exploded iPhone, drags a slider, and watches it assemble. They switch to Galaxy and the same slider collapses a gas cloud into a spiral. They switch to Big Bang and the same slider walks 13.8 billion years. Same controls, same concept, three timescales.

The whole build is a bet on one rule: every experience is a pure function `setTime(t)`. Reverse, scrub, jump, warp, and pause are consequences of that rule, not features to build.

This is a one-hour hackathon. Every line below is cut to fit. The longer version of this plan is in git history at tag `plan-24h` if the format ever changes.

## What ships in 60 minutes

| Ships | Cut |
| --- | --- |
| One slider, play, pause, reverse, warp select | Camera modes beyond orbit, keyboard shortcuts, presets |
| "What's happening?" panel from JSON events | Selection cards, filters panel, follow camera |
| Hover tooltip via raycaster | Screen turn-on, ghost outline, GLB loader |
| iPhone with 6 components, straight-line arcs | 12 components, bezier arcs, staged overlap tuning |
| Galaxy and Universe sharing ONE particle shader | Separate shaders, bloom, dark matter halo, instanced galaxies |
| Log slider for the universe with 8 labels | Effective-rate HUD line |
| Public GitHub Pages URL | Mobile layout, transitions, tags |

Filters are cut. If Cosmos finishes early, the first thing back in is a Stars/Gas toggle because it is two uniforms.

## Who is who

- **Core. Shiv (@shivaswaroop40).** Scaffold, `TimeController`, UI shell, registry, merges, deploy. Reverts a red `main`.
- **Cosmos. Junaid (@JunaidMohsin).** Galaxy and universe on one shared particle shader, universe and galaxy JSON, log slider knots.
- **iPhone. Arjun (@arjun-kodaganur).** Six components, pose interpolation, hover metadata, iPhone JSON.

Each lane's folders are listed in WORKFLOW.md. Nobody edits another lane's folder without a message first.

## Use the agents

Each developer runs Claude Code inside their own folder with `docs/CONTRACT.md` in context. The contract is the prompt. A lane that hand-types Three.js boilerplate for 40 minutes does not finish. A lane that says "implement `FourDExperience` for a galaxy per CONTRACT.md, particles in a `ShaderMaterial` with `uT`, 40k points" and then tunes the result does.

## Timeline

### 0:00 to 0:10. Scaffold (Core drives, others write data)

Shiv, in the `feature/core-engine` worktree, one PR at the end of the ten minutes:

- [ ] `npm create vite@latest . -- --template react-ts`, `npm i three @types/three`.
- [ ] `vite.config.ts` with `base: "/4sight/"`.
- [ ] `src/core/types.ts` pasted from CONTRACT.md.
- [ ] `TimeController.ts`, `mappings.ts`, `interpolate.ts`, `Timeline.ts` helpers.
- [ ] `SceneManager.ts` with one `requestAnimationFrame` loop: `tick`, `setTime`, `render`.
- [ ] Mock cube experience wired to a range input. Cube at A, B, C at 0, 0.5, 1.
- [ ] `.github/workflows/deploy.yml` (deploy only, not a check). Merge the PR. Confirm https://shivaswaroop40.github.io/4sight/ shows the cube.

Arjun and Junaid, in parallel, no code yet:

- [ ] Arjun writes `public/data/iphone.json`: six components (frame, battery, logic board, main camera, speaker, display) with `id`, `name`, `description`, `assembled {position, rotation, size, color}`, `exploded {position, rotation}`, `stage {start, end}`.
- [ ] Junaid writes `public/data/universe.json` from the reference table below and `public/data/galaxy.json` with six events from gas cloud to mature galaxy.

Exit check at 0:10: everyone rebases their worktree on `origin/main`, `npm install`, `npm run dev`, drags the slider, sees the cube move. Do not split before this works.

### 0:10 to 0:40. Lanes

Everyone works in their own worktree on their own branch and merges their own PRs to `main`. No CI, no reviews, just build locally, PR, merge. See WORKFLOW.md. Folder ownership prevents conflicts. A merge that breaks the build gets reverted by Shiv, no discussion.

**Core (Shiv)**

- [ ] `OrbitControls` camera. One preset per experience, applied on switch.
- [ ] `Timeline.tsx` bound to `u`, tick labels from `mapping.ticks()`, end labels from `experience.labels`, event markers you can click.
- [ ] `TimeControls.tsx` (play, pause, reverse, reset) and `TimeWarp.tsx` (select from `warpPresets`).
- [ ] `InfoPanel.tsx` rendering `getCurrentEvent(t)`. Title, `when`, description, key points.
- [ ] `ObjectInfo.tsx` tooltip at the cursor from the raycaster hover id.
- [ ] `ExperienceNav.tsx` and `experiences/index.ts` registry. Switch disposes, mounts, resets `u` to 0.
- [ ] Layout: header with nav, viewport, right panel, bottom transport bar. Dark background, one glass style, done.
- [ ] `useTimeState` hook that subscribes to the controller. No React state in the render loop.

**iPhone (Arjun)**

- [ ] `IPhoneState.ts`: `componentPose(c, t)`. `s = easeInOutCubic(window(t, c.stage.start, c.stage.end))`. Position `lerp(exploded, assembled, s)`. Rotation slerp. Pure.
- [ ] Stages: frame 0.0 to 0.2, logic board 0.15 to 0.4, battery 0.3 to 0.55, camera 0.45 to 0.65, speaker 0.55 to 0.75, display 0.7 to 1.0.
- [ ] `IPhoneExperience.ts`: one `Mesh` per component from `BoxGeometry` and `MeshStandardMaterial`, `userData.id`, registered as hoverable. `setTime` applies poses. One directional light and one hemisphere light inside `mount`.
- [ ] `getHoveredObject(id)` returns the JSON entry.
- [ ] If time remains: emissive lift on hover, then `RoundedBoxGeometry` from `three/examples/jsm/geometries`.

**Cosmos (Junaid)**

Both experiences use one `ParticleField` class in `experiences/shared/` with one shader. The two experiences differ only in the attribute generator and the colour ramp.

- [ ] `ParticleField.ts`: `Points` + `ShaderMaterial`. Attributes `aStart` (vec3), `aEnd` (vec3), `aBirth` (float), `aHue` (float). Uniforms `uT`, `uSpin`, `uScale`, `uRampA`, `uRampB`.
- [ ] Vertex shader: `p = mix(aStart, aEnd, smoothstep(0.0, 1.0, uT))`, rotate about y by `uSpin * uT / (1.0 + length(p.xz))` for differential rotation, scale by `uScale`. `gl_PointSize` from distance. Alpha from `smoothstep(aBirth, aBirth + 0.1, uT)`.
- [ ] Fragment shader: soft disc, colour `mix(uRampA, uRampB, aHue)`, additive blending.
- [ ] `GalaxyExperience.ts`: 40k points, `aStart` in a sphere, `aEnd` on a log spiral with scatter, `uSpin` nonzero, linear mapping over 0 to 1e9 years, `baseDurationSeconds` 20.
- [ ] `UniverseExperience.ts`: 40k points, `aStart` in a tiny sphere, `aEnd` in a large clustered field (three or four gaussian blobs is enough), `uScale` from a three-regime scale factor, colour ramp white to orange to blue-white, `piecewiseLogMapping` on the knots below, `baseDurationSeconds` 40.
- [ ] Two invisible proxy spheres per experience registered as hoverables with metadata.
- [ ] If time remains: `Stars/Gas` toggle as one uniform, exposed through `getAvailableFilters()`.

### 0:40 to 0:50. Integrate

- [ ] Each lane has merged their final PR, their registry line is in, and `npm run build` passes on `main`.
- [ ] Together, on one screen, walk the definition of done. Fix only what blocks the demo.
- [ ] Switch experiences ten times. No console errors.

### 0:50 to 0:60. Ship and rehearse

- [ ] Merge the last PR. Watch the deploy run. Open the public URL on a second device.
- [ ] Run the demo script once with a timer. Then stop typing.

## Demo script (90 seconds)

1. Open on Big Bang at `u = 0`. "Time is not something we animate. It is the dimension we move through." (10 s)
2. Play. Point at the log labels as the CMB and First Stars pass. Pause at First Stars, read the panel. (25 s)
3. Drag to Today, drag back to Dark Ages. "Nothing is pre-rendered. Every frame is `getState(t)`." (15 s)
4. Switch to Galaxy. Play. Orbit. (15 s)
5. Switch to iPhone. Exploded. Hover the battery. Play at 2x. Reverse. (20 s)
6. "Same slider. Same engine. Seconds, millions of years, billions of years." (5 s)

## Cosmic timeline reference (for `universe.json`)

Years after the Big Bang. Approximate. Do not present them as more precise than shown.

| Event | Time (years) | Label |
| --- | --- | --- |
| Big Bang | 0 | Big Bang |
| Inflation ends | 3e-44 (about 1e-36 s) | Inflation |
| Particle era | 3e-13 (about 1e-5 s) | Particle Era |
| Nucleosynthesis | 6e-6 (about 3 min) | Nucleosynthesis |
| First atoms, CMB released | 3.8e5 | First Atoms / CMB |
| Dark ages | 1e6 | Dark Ages |
| First stars | 2e8 | First Stars |
| First galaxies | 4e8 | First Galaxies |
| Galaxy formation | 1e9 | Galaxy Formation |
| Galaxy evolution | 3e9 | Galaxy Evolution |
| Milky Way disk | 5e9 | Milky Way |
| Solar System | 9.2e9 | Solar System |
| Earth | 9.25e9 | Earth |
| Modern universe | 1.0e10 | Modern Universe |
| Today | 1.38e10 | Today |

Slider knots: 0, 3.2e-8 (1 s), 5.7e-6 (3 min), 3.8e5, 2e8, 1e9, 9.2e9, 1.38e10. The first segment log-interpolates from 1e-44 years so inflation sits at a visible position.

## Definition of done

- iPhone opens exploded, hover shows a tooltip, scrub assembles and disassembles, play and reverse and warp work.
- Galaxy opens as a cloud and becomes a spiral as `u` increases, in both directions.
- Big Bang opens at the Big Bang, the log slider has eight labels, the panel updates at every event, Today is reachable.
- Switching experiences never reloads or errors.
- The public URL works.

## Risks

| Risk | Mitigation |
| --- | --- |
| Scaffold takes longer than 10 minutes | Core starts it the moment the clock starts. If the deploy is not green by 0:10, split anyway and fix deploy at 0:40. |
| Cosmos shader does not compile | Use the recipe above verbatim. A field of moving coloured points is enough. |
| Two lanes edit the same file | Only the registry is shared. Everything else lives in your folder. |
| Someone waits on someone | Nobody waits. Data files first, then code against the mock's `SceneContext`. |
| Final merge breaks the build | Every lane runs `npm run build` before opening a PR. Shiv reverts a red `main` immediately. |
