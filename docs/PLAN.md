# 4sight build plan (60 minutes)

One time engine drives two worlds. A judge opens the site, sees an exploded iPhone, drags a slider, and watches it assemble. They switch to Solar System and the same slider collapses a cloud of gas and dust into the Sun and eight planets, across 4.6 billion years. Same controls, same concept, two timescales.

Scope change on 2026-09-25: the Cosmos lane builds one Solar System formation experience instead of Galaxy and Big Bang.

The whole build is a bet on one rule: every experience is a pure function `setTime(t)`. Reverse, scrub, jump, warp, and pause are consequences of that rule, not features to build.

This is a one-hour hackathon. Every line below is cut to fit. The longer version of this plan is in git history at tag `plan-24h` if the format ever changes.

## What ships in 60 minutes

| Ships | Cut |
| --- | --- |
| One slider, play, pause, reverse, warp select | Camera modes beyond orbit, keyboard shortcuts, presets |
| "What's happening?" panel from JSON events | Selection cards, filters panel, follow camera |
| Hover tooltip via raycaster | Screen turn-on, ghost outline, GLB loader |
| iPhone with 6 components, straight-line arcs | 12 components, bezier arcs, staged overlap tuning |
| Solar System on one particle shader plus simple planet meshes | Bloom, realistic textures, moons, asteroid belt physics |
| Log slider for the solar system with 8 labels | Accurate orbital mechanics |
| Public GitHub Pages URL | Mobile layout, transitions, tags |

Filters are cut. If Cosmos finishes early, the first thing back in is a Gas/Dust toggle because it is one uniform.

## Who is who

- **Core. Shiv (@shivaswaroop40).** Scaffold, `TimeController`, UI shell, registry, merges, deploy. Reverts a red `main`.
- **Cosmos. Junaid (@JunaidMohsin).** Solar System formation, from molecular cloud to today's Sun and planets. Particle disk, planet meshes, `solar-system.json`, log slider knots.
- **iPhone. Arjun (@arjun-kodaganur).** Six components, pose interpolation, hover metadata, iPhone JSON.

Each lane's folders are listed in WORKFLOW.md. Nobody edits another lane's folder without a message first.

## Use the agents

Each developer runs Claude Code inside their own folder with `docs/CONTRACT.md` in context. The contract is the prompt. A lane that hand-types Three.js boilerplate for 40 minutes does not finish. A lane that says "implement `FourDExperience` for solar system formation per CONTRACT.md, disk particles in a `ShaderMaterial` with `uT`, 40k points" and then tunes the result does.

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
- [ ] Junaid writes `public/data/solar-system.json` from the reference table below: events, plus the eight planets with name, description, orbit radius in AU, size, colour, and formation window.

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

One experience in `src/experiences/solar-system/`. Register it as `solarSystemExperience` with id `"solarSystem"`.

- [ ] `SolarSystemState.ts`: pure functions of `t`. `collapse(t)` shrinks the cloud radius, `flatten(t)` squashes it into a disk, `sunIgnition(t)` ramps the protosun from a dull red glow to a bright main-sequence Sun, `planetGrowth(planet, t)` grows each planet inside its formation window, `gasCleared(t)` fades the remaining gas.
- [ ] Particle disk: `Points` + `ShaderMaterial`, 40k points. Attributes `aCloud` (vec3, random in a sphere) and `aDisk` (vec3, on a thin disk, denser inward), `aBirth`, `aHue`. Uniforms `uT`, `uFlatten`, `uGas`. Vertex: mix cloud to disk by `uFlatten`, rotate about y by `uT * k / sqrt(r)` so the inner disk spins faster. Fragment: soft disc, warm colours near the Sun, cool dust outside, additive blending, alpha scaled by `uGas`.
- [ ] The Sun: a sphere with an emissive material plus a glow sprite. Colour and scale driven by `sunIgnition(t)`.
- [ ] Planets: eight small spheres from `solar-system.json` on circular orbits at their AU radius (compressed with a sqrt or log scale so all fit). Radius scales with `planetGrowth`. Each orbits at a speed proportional to `r^-1.5`, so the scene keeps moving. Each is a hoverable with its metadata.
- [ ] Faint orbit rings that fade in as planets finish forming.
- [ ] `piecewiseLogMapping` on the knots below, `baseDurationSeconds` 40, events from `solar-system.json`.
- [ ] Hoverables: the Sun, each planet, and one invisible proxy for the protoplanetary disk.
- [ ] If time remains: Gas/Dust toggle as one uniform, exposed through `getAvailableFilters()`.

### 0:40 to 0:50. Integrate

- [ ] Each lane has merged their final PR, their registry line is in, and `npm run build` passes on `main`.
- [ ] Together, on one screen, walk the definition of done. Fix only what blocks the demo.
- [ ] Switch experiences ten times. No console errors.

### 0:50 to 0:60. Ship and rehearse

- [ ] Merge the last PR. Watch the deploy run. Open the public URL on a second device.
- [ ] Run the demo script once with a timer. Then stop typing.

## Demo script (90 seconds)

1. Open on Solar System at `u = 0`, a dark cloud of gas and dust. "Time is not something we animate. It is the dimension we move through." (10 s)
2. Play. The cloud collapses, flattens into a disk, and the Sun ignites. Pause at Jupiter forms and read the panel. (25 s)
3. Drag to Today, then back to the protoplanetary disk. "Nothing is pre-rendered. Every frame is `getState(t)`." (15 s)
4. Orbit the finished solar system. Hover Earth. (15 s)
5. Switch to iPhone. Exploded. Hover the battery. Play at 2x. Reverse. (20 s)
6. "Same slider. Same engine. Seconds, millions of years, billions of years." (5 s)

## Solar System timeline reference (for `solar-system.json`)

Years since the collapse of the Sun's parent cloud core, about 4.57 billion years ago. Approximate, per the standard nebular model. Do not present them as more precise than shown.

| Event | Time (years) | Label |
| --- | --- | --- |
| Molecular cloud core collapses | 0 | Cloud Collapse |
| Protosun and spinning disk form | 1e5 | Protosun |
| First solids condense (CAIs) | 3e5 | First Solids |
| Dust clumps into planetesimals | 1e6 | Planetesimals |
| Jupiter's core forms, Jupiter grows | 3e6 | Jupiter Forms |
| Saturn, Uranus, Neptune form | 5e6 | Giant Planets |
| Solar wind clears the gas | 1e7 | Gas Cleared |
| Sun reaches the main sequence | 5e7 | Sun Ignites |
| Rocky planets finish forming | 1e8 | Rocky Planets |
| Moon-forming impact on Earth | 1e8 | Moon Forms |
| Giant planets migrate (Nice model, debated) | 5e8 | Migration |
| Today | 4.57e9 | Today |

Slider knots: 0, 1e5, 1e6, 3e6, 1e7, 1e8, 1e9, 4.57e9. The first segment log-interpolates from 1e3 years so the collapse is visible.

Planet data for `solar-system.json`, orbit radius in AU: Mercury 0.39, Venus 0.72, Earth 1.0, Mars 1.52, Jupiter 5.2, Saturn 9.5, Uranus 19.2, Neptune 30.1. Formation windows: giants 1e6 to 1e7, rocky planets 1e6 to 1e8.

## Definition of done

- iPhone opens exploded, hover shows a tooltip, scrub assembles and disassembles, play and reverse and warp work.
- Solar System opens as a cloud, collapses into a disk with a glowing Sun, and ends with eight planets orbiting, in both directions.
- The log slider has eight labels, the panel updates at every event, Today is reachable, and hovering a planet shows its metadata.
- Switching experiences never reloads or errors.
- The public URL works.

## Risks

| Risk | Mitigation |
| --- | --- |
| Scaffold takes longer than 10 minutes | Core starts it the moment the clock starts. If the deploy is not green by 0:10, split anyway and fix deploy at 0:40. |
| Cosmos shader does not compile | Use the recipe above verbatim. A disk of moving coloured points plus the Sun and planet spheres is enough. |
| Two lanes edit the same file | Only the registry is shared. Everything else lives in your folder. |
| Someone waits on someone | Nobody waits. Data files first, then code against the mock's `SceneContext`. |
| Final merge breaks the build | Every lane runs `npm run build` before opening a PR. Shiv reverts a red `main` immediately. |
