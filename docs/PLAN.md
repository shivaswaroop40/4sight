# 4sight build plan

One time engine drives three worlds. A judge opens the site, sees an exploded iPhone, drags a slider, and watches it assemble. They switch to Galaxy and the same slider collapses a gas cloud into a spiral. They switch to Big Bang and the same slider walks 13.8 billion years. Same controls, same concept, three timescales.

The whole build is a bet on one rule: every experience is a pure function `setTime(t)`. Everything the brief asks for (reverse, scrub, jump, warp, pause) is a consequence of that rule, not a feature to build.

Time budgets below assume a 24-hour hackathon. For 48 hours, double Phase 2 and Phase 4 and leave the rest alone.

## Architecture decisions

1. **Parameter-space playback.** The TimeController advances `u` in `[0, 1]`. Each experience maps `u` to its own time. See [CONTRACT.md](CONTRACT.md). This is what makes one controller drive seconds and gigayears.
2. **State lives outside React.** The TimeController is a plain class with a subscribe method. The Three.js loop reads it directly each frame. React subscribes only for the HUD and panels, and only to the fields it renders. No `useState` in the render loop, ever.
3. **One renderer, one scene, swappable experiences.** `SceneManager` owns the canvas, the render loop, resize, and disposal. Switching experiences calls `dispose()` on the old one and `mount()` on the new one. The renderer never restarts.
4. **Experiences are self-contained folders.** Each folder holds its class, its state math, its data loader, and a `dev.tsx` harness. The only shared write point is one line in the experience registry.
5. **Particles are shader-driven.** Galaxy and universe stars are `THREE.Points` with a custom `ShaderMaterial`. Time is a uniform. The vertex shader computes each particle's position from its own attributes and `uTime`. Zero per-particle JavaScript per frame. Reverse is free because the shader is stateless.
6. **Data in JSON, not components.** Component metadata, timeline events, and explanations load from `public/data/*.json` through `import.meta.env.BASE_URL`. The InfoPanel is a dumb renderer of `getCurrentEvent(t)`.
7. **Primitives first, GLB later.** The iPhone is built from `RoundedBoxGeometry` primitives keyed by component id. A GLB loader that maps node names to the same ids can replace it without touching the trajectory code. Do not spend hackathon hours hunting for a model.

## Directory layout

```text
src/
  core/
    types.ts            the frozen contract
    TimeController.ts
    mappings.ts         linearMapping, piecewiseLogMapping
    interpolate.ts      lerp, smoothstep, ease, window
    Timeline.ts         eventAt
  renderer/
    SceneManager.ts     canvas, loop, resize, mount/dispose
    CameraManager.ts    orbit, free, follow, overview, presets
    Raycaster.ts        hoverable registry, pointer events
  interaction/
    HoverManager.ts
    SelectionManager.ts
    InteractionManager.ts
  filters/
    FilterManager.ts
    galaxyFilters.ts
    universeFilters.ts
  experiences/
    index.ts            registry, one line per experience
    mock/
    iphone/
      IPhoneExperience.ts
      IPhoneState.ts    trajectories, pure math
      iphoneData.ts     loads public/data/iphone.json
      dev.tsx
    galaxy/
      GalaxyExperience.ts
      GalaxyState.ts
      galaxyData.ts
      shaders/
      dev.tsx
    universe/
      UniverseExperience.ts
      UniverseState.ts
      universeData.ts
      shaders/
      dev.tsx
  ui/
    Timeline.tsx        slider in u space, ticks, end labels
    TimeControls.tsx    play, pause, reverse, reset
    TimeWarp.tsx
    InfoPanel.tsx       "What's happening?"
    ObjectInfo.tsx      hover tooltip and selection card
    FilterPanel.tsx
    PerspectiveControls.tsx
    ExperienceNav.tsx
  app/
    App.tsx
    store.ts            subscribe hooks over TimeController
public/
  data/iphone.json  galaxy.json  universe.json
  models/iphone/    (empty until a GLB exists)
  textures/
.github/workflows/deploy.yml
```

## Phase 0. Scaffold and a live URL (30 minutes, core lane)

While the other two read CONTRACT.md and WORKFLOW.md.

- [ ] `npm create vite@latest . -- --template react-ts`, add `three`, `@types/three`, Tailwind.
- [ ] `vite.config.ts` with `base: "/4sight/"`.
- [ ] `.github/workflows/deploy.yml`: checkout, setup-node 22, `npm ci`, `npm run build`, `actions/upload-pages-artifact`, `actions/deploy-pages`. Trigger on push to `main` and `workflow_dispatch`. Pages is already configured to deploy from Actions.
- [ ] Push a "4sight" placeholder page to `main`. Confirm https://shivaswaroop40.github.io/4sight/ loads.
- [ ] Create `develop` from `main`. Everyone branches from `develop`.

Exit check: the public URL renders. The deploy pipeline is proven before a single feature exists.

## Phase 1. Contract and the cube (60 to 90 minutes, all three)

Pair on one machine or share a screen. The point is shared understanding, not throughput.

- [ ] `src/core/types.ts` typed exactly as CONTRACT.md.
- [ ] `TimeController` with `tick`, `subscribe`, `attach`, clamp at the ends, pause at the boundary.
- [ ] `SceneManager` with a single `requestAnimationFrame` loop that calls `controller.tick(dt)` then `experience.setTime(state.time)` then `renderer.render`.
- [ ] `Timeline.tsx` slider bound to `u`, `TimeControls.tsx`, `TimeWarp.tsx`.
- [ ] `InfoPanel.tsx` reading `getCurrentEvent`.
- [ ] `Raycaster.ts` with the hoverable registry and a tooltip.
- [ ] The mock cube experience from CONTRACT.md.
- [ ] Run the six exit checks in CONTRACT.md. All pass.
- [ ] Merge to `develop` and `main`. Tag `phase-1`. Freeze `types.ts`.

Do not split before the six checks pass. Every hour spent here saves three in Phase 3.

## Phase 2. Parallel lanes (12 to 14 hours)

Each lane works in its own folder against the mock. Each list is ordered. Finish P0 before touching P1.

### Core lane

P0

- [ ] `CameraManager`: `orbit` via `OrbitControls`. `overview` computes the scene bounding sphere and frames it. `follow` sets the orbit target to the selected object each frame. `free` is `OrbitControls` with screen-space panning and no target lock.
- [ ] `piecewiseLogMapping` with tests on the universe knots (below). `toParam(toTime(u))` round-trips within 1e-9.
- [ ] Tick labels under the slider from `mapping.ticks()`. End labels from `experience.labels`.
- [ ] Event markers on the slider from `experience.events`. Click a marker to `jumpToEvent`.
- [ ] `ExperienceNav.tsx` and the registry. Switching disposes the old experience, mounts the new one, resets the controller to `u = 0`, and applies the new experience's first camera preset.
- [ ] `store.ts`: `useTimeState(selector)` that re-renders a component only when its selected fields change.
- [ ] Layout from the brief: header with nav, viewport left, InfoPanel right, transport bar bottom. Dark glass panels. Responsive collapse of the InfoPanel below 900px.
- [ ] HUD line under the warp control: "1x = 230 million years per second here" computed from the mapping derivative.

P1

- [ ] `PerspectiveControls.tsx` with the four modes plus per-experience presets.
- [ ] Keyboard: space toggles play, `R` reverses, `←`/`→` nudge `u`, `0` resets.
- [ ] Smooth camera transitions between presets (lerp position and target over 600ms).
- [ ] `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, pause the loop when the tab is hidden.

### iPhone lane

P0

- [ ] `public/data/iphone.json`: twelve components with `id`, `name`, `description`, `properties`, `assembled: {position, rotation, size, color}`, `exploded: {position, rotation}`, `stage: {start, end}`. Components: frame, back glass, display, battery, logic board, main camera, front camera, speaker, taptic engine, SIM tray, volume buttons, power button.
- [ ] `IPhoneState.ts`: `componentPose(component, t)` returns position and quaternion. `s = easeInOutCubic(window(t, stage.start, stage.end))`. Position follows a quadratic bezier from exploded to assembled with a control point offset outward, so parts arc in rather than slide. Rotation slerps. Pure functions, unit tested at t = 0, 0.5, 1.
- [ ] Stage order: frame first (0.00 to 0.15), then logic board, battery, taptic, speaker, cameras, buttons and SIM, then display (0.70 to 0.90), then back glass (0.85 to 1.00). Neighbouring stages overlap by about 0.05 so the motion never stalls.
- [ ] `IPhoneExperience.ts`: builds one `THREE.Group` per component from `RoundedBoxGeometry` and `MeshStandardMaterial`. Each group has `userData.id`. Registers every group as hoverable. `setTime(t)` applies `componentPose` to each group.
- [ ] Lighting inside the experience folder: one key directional, one soft fill, an `Environment`-style hemisphere light. Warm and clean.
- [ ] Screen on: for `t > 0.97` the display's emissive intensity ramps to 1 with a gradient texture. Reverses cleanly.

P1

- [ ] `interaction/HoverManager.ts`: raycaster hover id to `ObjectMetadata` to tooltip. Emissive lift on hover.
- [ ] `interaction/SelectionManager.ts`: click selects, outline or emissive highlight, `ObjectInfo` card, camera `follow` target.
- [ ] Ghost outline of the assembled phone at low opacity while disassembled, fading out as `t` approaches 1, so the viewer sees where parts are heading.
- [ ] GLB loader path: `loadFromGLB(url)` that maps node names to component ids and reuses the same pose math. Only if a good model turns up.

### Cosmos lane

P0, galaxy

- [ ] `public/data/galaxy.json`: events (gas cloud, collapse, first stars, disk forms, spiral arms, mature galaxy) in years from 0 to 1e9, hoverable regions with metadata, filter list.
- [ ] `GalaxyState.ts`: per particle attributes generated once with a seeded RNG. `cloudPos` random in a sphere, `diskPos` on a logarithmic spiral with arm scatter and vertical thickness falling off with radius, `birth` in `[0, 1]`, `temperature` in kelvin-ish, `kind` 0 star 1 gas 2 dust.
- [ ] `shaders/galaxy.vert`: `p = mix(cloudPos, diskPos, ease(uT))`, then rotate about y by `omega(r) * uT` with `omega` decreasing with radius so arms wind up over time. Size from kind and distance. Alpha fades in after `birth`.
- [ ] `shaders/galaxy.frag`: soft disc sprite, colour from a temperature ramp, additive blending for stars, normal blending for dust.
- [ ] Core glow sprite that brightens with `uT`. Faint dark matter halo as a second sparse `Points` at large radius.
- [ ] 80,000 particles total. Verify 60fps on an integrated GPU laptop. Halve if not.
- [ ] Hoverables: four invisible proxy spheres (core, inner arm, outer arm, dust lane) whose metadata changes description with `t`.

P0, universe

- [ ] `public/data/universe.json`: the fifteen events from the brief with times in years, `when` strings, descriptions, key points. Reference table below.
- [ ] `UniverseState.ts`: `stageWeights(t)` returns a vector of smoothstep windows in log-time (plasma, recombination, dark ages, first stars, galaxies, structure, modern). Visuals blend by these weights. Also `scaleFactor(t)` approximated in three regimes (radiation, matter, dark energy) for the expansion radius.
- [ ] Particle field: 60,000 points in a sphere. Radius scales with `scaleFactor`. Colour ramps from white-hot plasma to orange to near black (dark ages) to blue-white star sparks (first stars) to warm galaxy clusters.
- [ ] Clustering: each particle has a `home` position on a noise-driven filament field. Position is `mix(uniform, home, structureWeight)`. Structure emerges continuously.
- [ ] Galaxies: an `InstancedMesh` of 2,000 small spiral sprites that fade in with the galaxy weight and sit at filament nodes.
- [ ] A CMB shell: a translucent sphere at the horizon whose opacity peaks at recombination and fades.
- [ ] Hoverables: proxy objects for "First stars", "Galaxy cluster", "Cosmic web filament", "CMB horizon". Metadata text changes with `t`.
- [ ] `piecewiseLogMapping` knots: Big Bang, 1 s, 3 min, 380 k yr, 200 M yr, 1 Gyr, 9.2 Gyr, Today. Eight labels, seven equal slider segments.

P1

- [ ] `filters/FilterManager.ts` and filters that set uniforms: Stars, Gas, Dust toggles. Colour mode radio group: Natural, Temperature, Age, Density. Dark Matter toggle.
- [ ] `FilterPanel.tsx` reads `getAvailableFilters()`. Shared by both cosmic experiences.
- [ ] Bloom via `UnrealBloomPass` behind a quality toggle. Off by default on `devicePixelRatio > 2`.
- [ ] Camera presets: Top, Side, Perspective for both.

## Phase 3. Integration (2 hours, all three)

- [ ] Each lane adds its one registry line and merges to `develop`. Order: core, then iphone, then cosmos.
- [ ] Walk the definition of done below, together, on one screen.
- [ ] Fix mount and dispose leaks: switch experiences twenty times, check `renderer.info.memory` returns to baseline.
- [ ] Merge to `main`. Verify the public URL. Tag `phase-3`.

## Phase 4. Polish (3 to 4 hours)

- [ ] Transitions between experiences: fade the viewport to black for 300ms around the swap.
- [ ] Event pulse: when playback crosses an event, the InfoPanel title glows once.
- [ ] Landing state per experience: iPhone at `u = 0` framed from a three-quarter angle, galaxy at `u = 0` from above, universe at `u = 0` inside the plasma.
- [ ] Mobile: transport bar stays usable at 390px width. InfoPanel becomes a bottom sheet.
- [ ] README with a screenshot and the live URL.
- [ ] Nothing new after this point. Bugs only.

## Phase 5. Ship and rehearse (1 hour)

- [ ] `npm run build && npm run preview`, click through everything at the base path.
- [ ] Merge to `main`. Wait for the deploy. Open the public URL on a second device and on a phone.
- [ ] Run the demo script twice with a timer.

## Demo script (three minutes)

1. Open the site on Big Bang at `u = 0`. Say the one line: "Time is not something we animate. It is the dimension we move through." (10 s)
2. Press play at 1x. Point at the log slider labels as inflation, nucleosynthesis, and the CMB pass. (30 s)
3. Pause at First Stars. Read the panel. Hover a star cluster. (15 s)
4. Drag to Today. Drag back to the Dark Ages. "Nothing is pre-rendered. Every frame is `getState(t)`." (15 s)
5. Switch to Galaxy. Play. Toggle the Temperature filter. Switch to Top view. (30 s)
6. Switch to iPhone. It is exploded. Orbit it. Hover the battery. (20 s)
7. Play at 2x. Watch it assemble. Screen turns on. Reverse. It comes apart. (30 s)
8. Close: "Same slider. Same engine. Seconds, millions of years, billions of years." (10 s)

## Cosmic timeline reference (for `universe.json`)

Times are years after the Big Bang. Approximate, per the standard model summary. Do not present them as more precise than shown.

| Event | Time (years) | Label |
| --- | --- | --- |
| Big Bang | 0 | Big Bang |
| Inflation ends | 3e-44 (about 1e-36 s) | Inflation |
| Quark-gluon plasma, particle era | 3e-13 (about 1e-5 s) | Particle Era |
| Nucleosynthesis | 6e-6 to 1e-3 (10 s to 20 min) | Nucleosynthesis |
| Recombination, first atoms, CMB released | 3.8e5 | First Atoms / CMB |
| Dark ages | 3.8e5 to 1e8 | Dark Ages |
| First stars | 1e8 to 2e8 | First Stars |
| First galaxies | 4e8 | First Galaxies |
| Galaxy formation peak | 1e9 to 3e9 | Galaxy Formation |
| Milky Way disk forms | about 5e9 | Milky Way |
| Galaxy evolution, mergers | 3e9 to 9e9 | Galaxy Evolution |
| Solar System forms | 9.2e9 | Solar System |
| Earth forms | 9.25e9 | Earth |
| Modern universe, dark energy dominates | 1.0e10 | Modern Universe |
| Today | 1.38e10 | Today |

Slider knots: 0, 3.2e-8 (1 s), 5.7e-6 (3 min), 3.8e5, 2e8, 1e9, 9.2e9, 1.38e10. The first segment log-interpolates from 1e-44 years so that inflation sits at a visible position.

## Risks

| Risk | Mitigation | Owner |
| --- | --- | --- |
| Contract changes after the freeze | Changes go through chat with all three agreeing. Add fields, never rename. | everyone |
| Particle counts tank the frame rate on the demo laptop | Test on the weakest machine in the team at Phase 2 midpoint. Particle counts are constants at the top of each state file. | cosmos |
| The iPhone looks like coloured boxes | Bevelled geometry, a metallic frame material, a glass display, good lighting, and motion quality carry it. Judges watch the assembly, not the mesh. | iphone |
| Merge conflicts in shared UI | Only the core lane edits `ui/` and `app/`. Experience needs go through the contract, not through the UI. | core |
| Deploy breaks on the final push | Phase 0 proves the pipeline. `main` only receives tested `develop`. Keep the Phase 3 tag as a rollback. | core |
| Universe at `u = 0` is a blank white sphere | Give the plasma texture and motion at `t = 0`. Landing on an interesting frame matters more than accuracy. | cosmos |
| Someone is blocked waiting | Each folder has `dev.tsx`. Nobody needs another lane to run. | everyone |

## Definition of done

iPhone

1. Opens disassembled. 2. Orbit, zoom, pan. 3. Hover shows a tooltip with name and description. 4. Click selects and highlights. 5. Scrub assembles it. 6. Scrub back disassembles it. 7. Play, pause, reverse work. 8. Warp changes the pace. 9. Reset returns to `u = 0`.

Galaxy

1. Opens as a gas cloud. 2. Continuous evolution to a spiral as `u` increases. 3. Play and reverse. 4. At least three filters change the look. 5. At least three camera perspectives. 6. Hover shows metadata on four regions.

Big Bang

1. Opens at the Big Bang. 2. Log slider with eight readable labels. 3. Every one of the fifteen events updates the panel. 4. Continuous visual change with no hard cuts. 5. Play, reverse, warp, jump to event. 6. Reaches Today.

Global

1. Switching experiences never reloads the page or leaks memory. 2. The public GitHub Pages URL works on desktop and phone. 3. A stranger understands the concept within 30 seconds of the demo script.
