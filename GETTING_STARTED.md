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
- Junaid: `../4sight-cosmos` and `feature/cosmos` (Solar System lane)

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

While Shiv scaffolds, write your data file. No code yet.

```
I'm the Cosmos lane in a 60-minute hackathon. My experience is Solar
System formation: a molecular cloud collapses into today's Sun and eight
planets. Read docs/PLAN.md, the "Cosmos (Junaid)" section and the
"Solar System timeline reference".

Create public/data/solar-system.json with:
- events: each with id, time (years since collapse), title, when
  (string), description, keyPoints (array). Use the reference table.
- planets: the eight planets, each with id, name, description,
  orbitAU, radius (display units), color, formation {start, end} in
  years, and properties (a few facts).
- sun: id, name, description, properties.

Don't write code. Just the JSON file.
```

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

Open Claude Code in `~/Desktop/code/4sight-cosmos`, rebased on `main`. Copy the prompt below.

```
I'm the Cosmos lane in a 60-minute hackathon. The team has scaffolded
React + TypeScript + Vite + Three.js on main. My experience is Solar
System formation, from a molecular cloud to today's solar system.

Read docs/CONTRACT.md, then docs/PLAN.md: the "Cosmos (Junaid)" section
and the "Solar System timeline reference". Read src/core/ and
src/experiences/index.ts to see the real helper names.

Build src/experiences/solar-system/ exactly as the Cosmos section lists:
SolarSystemState.ts (pure functions of t), a particle disk in a
ShaderMaterial, the Sun, eight planets on orbits, fading orbit rings,
piecewiseLogMapping on the knots in the plan, events and planet data
loaded with assetUrl("data/solar-system.json"). Register it with one
import and one array entry in src/experiences/index.ts as
solarSystemExperience, id "solarSystem".

setTime(t) must be pure: same t, same scene, in both directions.
Only touch src/experiences/solar-system/, public/data/solar-system.json,
and the one registry line.

Don't ask. Build it. Run npm run build, then commit and open a PR.
```

Exit checks: opens as a cloud, collapses to a disk, the Sun ignites, eight planets form and orbit, scrubbing back reverses it, events update the panel, hovering a planet shows its facts.

```bash
npm run build
git add -A
git commit -m "Add solar system formation experience"
git push
gh pr create --base main --fill
gh pr merge --squash --delete-branch=false
```

## Together, 0:40 to 0:50

Rebase everyone on `main`. Walk the definition of done:

- iPhone: disassembled, hover tooltip, scrub assembles/disassembles, play/pause/reverse/warp work.
- Solar System: cloud to disk to Sun and eight planets on the log slider, events update the panel, play/reverse/warp work.
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
