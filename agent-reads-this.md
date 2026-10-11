# Agent Progress Notes

Read `Planner.md` before changing code; it is the source of truth for scope and design decisions. Keep this file and the Planner status table synchronized as implementation and verification progress.

## Current progress

Statuses below reflect source inspection on 2026-10-11. They are not runtime test results.

| Planner step | Status | Current evidence / remaining work |
|---|---|---|
| 1. Frame and input contract | Not started | `scripts/main.js` uses `Trigger.afterGameUpdate` to finish one-tick stepping. It does not define a TAS frame counter or game-consumed input format. Prove the Mindustry 160.5 injection point before designing replay storage. |
| 2. Standalone control window | Prototype exists; planned work remains | `scripts/main.js` builds a draggable HUD `Table` with pause, step, save, and load controls. It resets the position on creation, uses `DragListener`, and the gear redirects `Vars.ui.settings`. Implement the planned window behavior, persisted position, and TAS-owned options dialog; test the window independently. |
| 3. Session and checkpoint ownership | Folder scaffolding only | `scripts/tas-saves.js` creates `branches/main/savestates/`, `branch.json`, and an empty `inputs.json`. TAS snapshots still use the global `tas-snapshot.msav`; there is no active project/branch/frame/input-cursor session model or branch-owned checkpoint metadata. |
| 4. Branch-aware input record/replay | Not started | No input recording, injection, cursor, child-branch creation, or inherited-input resolution is implemented. |
| 5. End-to-end Mindustry 160.5 verification | Not started | No planned in-game verification scenarios have been completed or recorded. |

## Progress log

Add a short entry when a milestone, significant implementation result, decision, or blocker changes. Keep evidence concrete; distinguish code inspection, syntax/build checks, automated tests, and in-game verification.

- **Date:** 2026-10-11
- **Planner step:** Baseline review
- **Change or result:** Recorded implementation status from the existing source; no code behavior was changed.
- **Evidence:** Inspected `scripts/main.js` and `scripts/tas-saves.js`. This was source inspection only; no build, automated test, or in-game test was run.
- **Blocker / next action:** Start with step 1 by proving the Mindustry 160.5 input injection point.

- **Date:**
- **Planner step:**
- **Change or result:**
- **Evidence:** files/code paths, command and result, or observed in-game behavior and game version
- **Blocker / next action:**

## Handoff rules

- Update the matching status in `Planner.md` and this file together. Do not mark work complete based on a plan or code presence alone.
- Preserve the existing project and branch folder layout and project creation/migration behavior.
- Keep window preferences separate from TAS route data; keep savestates and inputs under their project branch.
- Do not overwrite parent-branch future when loading an earlier checkpoint; the intended behavior is to fork.
- Keep TAS input capture/replay local and offline. Explicitly exclude actions that cannot be replayed deterministically in the first milestone.
- Report game-dependent behavior only as in-game verified when it has actually been tested on the stated Mindustry version.