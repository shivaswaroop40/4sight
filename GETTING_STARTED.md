# Getting started (60 minutes)

## One-time setup

Clone the repo and set up your worktree.

```bash
cd ~/Desktop/code
git clone git@github.com:shivaswaroop40/4sight.git
cd 4sight
git worktree add ../4sight-<your-lane> <your-feature-branch>
cd ../4sight-<your-lane>
npm install
```

Substitute your values:
- Shiv: `../4sight-core` and `feature/core-engine`
- Arjun: `../4sight-iphone` and `feature/iphone`
- Junaid: `../4sight-cosmos` and `feature/cosmos`

When you open Claude Code in your worktree folder, `npm run dev` and `npm run build` will work against your feature branch without touching `main`.

## The job: Shiv, 0:00 to 0:10

Open Claude Code in `~/Desktop/code/4sight-core`. Copy the prompt below into a new chat and send it.

```
I'm the Core lane in a three-person 60-minute hackathon building a 4D
explorer. Read docs/PLAN.md Phase 0 (lines 0:00 to 0:10). Read
docs/CONTRACT.md for the types.

Build everything Phase 0 lists for the Core lane:
- Vite scaffold (React, TypeScript, Three.js)
- vite.config.ts with base: "/4sight/"
- src/core/types.ts exactly as shown in CONTRACT.md
- TimeController.ts, mappings.ts, interpolate.ts, Timeline.ts
- SceneManager.ts with the render loop
- Mock cube experience (CONTRACT.md line ~160)
- GitHub Actions deploy.yml for GitHub Pages
- One test: cube at A, B, C at times 0, 0.5, 1

Stop after the commit. Don't merge yet. The deploy should run but you
won't merge to main until Arjun and Junaid write their data files.

Don't ask me questions. Build it.
```

When it's done, verify locally:

```bash
npm run dev
# Drag the slider. Cube moves A → B → C.
```

## The job: Arjun, 0:05 to 0:10 (in parallel)

While Shiv scaffolds, write your data file. You don't need code yet, just JSON.

Open Claude Code in `~/Desktop/code/4sight` (the main clone, not a worktree). Create `public/data/iphone.json`. Copy the prompt below.

```
I'm the iPhone lane in a 60-minute hackathon. Read docs/PLAN.md, the
iPhone subsection under "Phase 2. Parallel lanes" (the P0 bullet list).

Create public/data/iphone.json with six components:
- frame, battery, logic board, main camera, speaker, display

Each component needs:
  id, name, description, properties (optional),
  assembled: {position, rotation, size, color},
  exploded: {position, rotation},
  stage: {start, end}

The stages should overlap slightly and sum to 0-1.0. Put the frame
first and the display last. Use reasonable component sizes and colors.

Don't write code. Just the JSON data file. Output it as the final
artifact.
```

Paste the JSON into `public/data/iphone.json` in your main clone (not the worktree). Don't commit yet. You're feeding this to Shiv.

## The job: Junaid, 0:05 to 0:10 (in parallel)

While Shiv scaffolds, write your two data files. You don't need code yet, just JSON.

Open Claude Code in `~/Desktop/code/4sight` (the main clone). Create two files: `public/data/universe.json` and `public/data/galaxy.json`. Copy the prompt below.

```
I'm the Cosmos lane in a 60-minute hackathon. Read docs/PLAN.md, the
Cosmos subsection under "Phase 2. Parallel lanes" (the P0 bullet lists
for both galaxy and universe).

Create two JSON files:

1. public/data/universe.json
Fifteen timeline events from the Big Bang to Today. Each event:
  id, time (years), title, when (string), description, keyPoints (array)
Use the reference table in docs/PLAN.md (Cosmic timeline reference).

2. public/data/galaxy.json
Six events: gas cloud, gravitational collapse, star formation, structure
emerges, spiral arms, mature galaxy. Each event:
  id, time (years from 0 to 1e9), title, description, keyPoints

Don't write code. Just the two JSON data files. Output both as final
artifacts, or one artifact with both files if the tool allows.
```

Paste both JSONs into `public/data/universe.json` and `public/data/galaxy.json` in your main clone. Don't commit yet.

## Sync: 0:10 to 0:15

Shiv merges the scaffold PR. Arjun and Junaid add their JSON files, commit, open PRs, merge.

```bash
cd ~/Desktop/code/4sight
# Arjun adds iPhone data
git add public/data/iphone.json
git commit -m "Add iPhone component data"
git push -u origin feature/iphone
gh pr create --base main --fill
gh pr merge --squash --delete-branch=false

# Then rebase to get Shiv's scaffold
git fetch origin && git checkout main && git pull
```

Everyone else: `git rebase origin/main` in your worktree.

## The job: Arjun, 0:15 to 0:40

Open Claude Code in `~/Desktop/code/4sight-iphone`. Copy the prompt below.

```
I'm the iPhone lane in a 60-minute hackathon. My team has scaffolded
React + TypeScript + Vite + Three.js. I have JSON component data.

Read docs/CONTRACT.md (the FourDExperience interface and types).
Read docs/PLAN.md, the iPhone section under "Phase 2. Parallel lanes",
the P0 bullet list.

Build the iPhone experience end-to-end:

1. src/experiences/iphone/IPhoneState.ts
   - componentPose(component, t) returns position and quaternion
   - s = easeInOutCubic(window(t, stage.start, stage.end))
   - position: lerp from exploded to assembled
   - rotation: slerp from exploded to assembled
   - Pure function, no side effects

2. src/experiences/iphone/IPhoneExperience.ts
   - Implements FourDExperience interface from CONTRACT.md
   - Load public/data/iphone.json
   - In mount(): create one Mesh per component from BoxGeometry
   - Set userData.id on each mesh
   - Register each mesh as hoverable via ctx.registerHoverable
   - Add one directional light and one hemisphere light
   - In setTime(t): apply componentPose to each mesh
   - getState(t) returns the pose math
   - getCurrentEvent(t) returns null (no events for the iPhone)
   - getHoveredObject(id) returns the component's JSON entry

3. src/experiences/iphone/iphoneData.ts
   - Export the JSON data and a load function

4. Update src/experiences/index.ts
   - Import and register iPhoneExperience

That's it. The UI and TimeController are already built. No selection
cards, no screen turn-on, no camera presets.

Don't ask. Build it. When you're done, commit with a one-line message
and open a PR.
```

Exit checks from PLAN.md: orbit the phone, hover shows tooltip, scrub assembles and disassembles, play/pause/reverse/warp work.

Commit and open a PR:

```bash
npm run build
git add -A
git commit -m "Add iPhone experience"
git push
gh pr create --base main --fill
gh pr merge --squash --delete-branch=false
```

## The job: Junaid, 0:15 to 0:40

Open Claude Code in `~/Desktop/code/4sight-cosmos`. Copy the prompt below.

```
I'm the Cosmos lane in a 60-minute hackathon. My team has scaffolded
React + TypeScript + Vite + Three.js. I have JSON event data.

Read docs/CONTRACT.md (the FourDExperience interface and types).
Read docs/PLAN.md, the Cosmos section under "Phase 2. Parallel lanes",
the P0 bullet lists for both galaxy and universe.

Both experiences use one shared particle system. Build:

1. src/experiences/shared/ParticleField.ts
   - THREE.Points with ShaderMaterial
   - Attributes: aStart (vec3), aEnd (vec3), aBirth (float), aHue (float)
   - Uniforms: uT, uSpin, uScale, uRampA, uRampB (all vectors or floats)
   - Vertex shader:
     * p = mix(aStart, aEnd, smoothstep(0.0, 1.0, uT))
     * Rotate about y: angle = uSpin * uT / (1.0 + length(p.xz))
     * gl_PointSize from distance
     * Alpha: smoothstep(aBirth, aBirth + 0.1, uT)
   - Fragment shader:
     * Soft disc sprite (like a star)
     * Color: mix(uRampA, uRampB, aHue)
     * Additive blending

2. src/experiences/galaxy/GalaxyExperience.ts
   - Implements FourDExperience
   - 40k particles: aStart random sphere, aEnd on log spiral with scatter
   - linearMapping from 0 to 1e9 years
   - baseDurationSeconds: 20
   - uSpin nonzero
   - In mount(): create ParticleField, add to scene
   - In setTime(t): update uniforms from mapping
   - Events: load from public/data/galaxy.json
   - Hoverables: two invisible proxy spheres with metadata

3. src/experiences/universe/UniverseExperience.ts
   - Implements FourDExperience
   - 40k particles: aStart tiny sphere, aEnd in 3-4 gaussian blobs
   - piecewiseLogMapping (knots in PLAN.md Cosmic timeline reference)
   - baseDurationSeconds: 40
   - Color ramp: white to orange to blue-white
   - In mount(): create ParticleField
   - In setTime(t): update uScale from scale factor (three regimes: radiation,
     matter, dark energy), update other uniforms
   - Events: load from public/data/universe.json
   - Hoverables: two invisible proxy spheres

4. Update src/experiences/index.ts
   - Import and register both experiences

That's it. No filters, no bloom, no instanced galaxies, no separate
shaders.

Don't ask. Build it. When done, commit and open a PR.
```

Exit checks from PLAN.md: galaxy opens as cloud and becomes spiral, universe has all 15 events, both play/reverse/warp.

Commit and open a PR:

```bash
npm run build
git add -A
git commit -m "Add galaxy and universe experiences"
git push
gh pr create --base main --fill
gh pr merge --squash --delete-branch=false
```

## Together, 0:40 to 0:50

Rebase everyone on `main`. Walk the definition of done:

- iPhone: disassembled, hover tooltip, scrub assembles/disassembles, play/pause/reverse/warp work.
- Galaxy: cloud → spiral, play/reverse/warp work, events update panel.
- Big Bang: Big Bang → Today on log slider, 15 events, play/reverse/warp work.
- No memory leaks or console errors when switching.

Fix only what blocks the demo.

## Together, 0:50 to 1:00

Merge any last PRs. Open https://shivaswaroop40.github.io/4sight/ on a second device. Run the demo script from PLAN.md once.

---

## If an agent gets stuck

The agent runs against your working tree. If it stalls or errors:

1. Read the error. Is it a type mismatch? Missing import? Syntax error?
2. Fix it locally and commit.
3. Prompt the agent again with the error output and what you expect.
4. Or: run `npm run build` locally, see the real error, paste it to the agent.

The agent knows the contract and the plan. It's your partner, not your blocker.

## If you merge something broken

Revert immediately:

```bash
git revert -n <commit-hash>
git commit -m "Revert broken commit"
git push
```

Then the agent fixes it locally in a follow-up PR.
