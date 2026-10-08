---

Plan: TAS Window and Replay Lifecycle
Keep the existing project and branch folders. Replace the fragile panel/settings plumbing with a standalone window inspired by MI2, then make savestates and player inputs share one project/branch/frame lifecycle.
Steps

1. Define the frame and input contract. Before building replay storage, prove where Mindustry 160.5 accepts simulation-consumed input before a game update. Use one completed afterGameUpdate as the frame clock. Define held controls separately from ordered one-shot actions; don’t use raw key events or UI clicks as the replay format.
2. Build the standalone window. Replace the direct HUD table with a focused window component. Adapt MI2 Mindow2’s InputListener approach: capture touch-down, convert dragged coordinates to the parent space, clamp on release, and persist position in Core.settings. Keep panel preferences separate from route data. The gear should open a TAS-owned options dialog instead of modifying Vars.ui.settings internals. This phase can proceed alongside session design once the window/session interface is agreed.
3. Add active-session and checkpoint ownership. Track project, branch, frame, input cursor, and recording/replay mode together. Replace the single global snapshot file as the authority for TAS sessions with checkpoints under the active branch’s existing savestates/ directory. Store versioned metadata with the frame and input cursor. Update session state only after a validated SaveIO.load() succeeds.
4. Record and replay branch-aware inputs. Write game-consumed, frame-indexed inputs to the active branch’s existing inputs.json; inject them through the same gameplay path before that frame advances. Loading behind a branch tip creates a child branch using the existing parent/forkFrame model; preserve the parent’s future and resolve inherited inputs through the fork point.
5. Validate end to end in Mindustry 160.5. First test the window independently. Then record a known control sequence, checkpoint, continue, reload, and replay to the same checkpoint. Test rewinding into a child branch, two different projects, and corrupt/failed state loads.

Relevant files
    main.js — current panel, TAS load point, update hooks, pause/step, and global snapshot actions.
    tas-saves.js — preserve project creation, migration, and existing branches/<id>/inputs.json and savestates/ paths; add only narrow path or metadata helpers.
    Proposed modules: scripts/tas-control-window.js, scripts/tas-session.js, scripts/tas-inputs.js, and scripts/tas-savestates.js.
    mod.hjson — leave MI2 as an optional reference; do not add a hard dependency.
    MI2 patterns to learn from: Mindow2, PopupTable, and SettingHandler.

Decisions
    Stay standalone; adapt MI2’s input-listener, coordinate conversion, clamping, and preference-separation patterns without depending on its Java classes.
    Preserve the current custom folder layout. Window geometry belongs in user preferences; savestates and inputs belong to their project branch.
    Loading an earlier checkpoint forks history rather than overwriting it.
    Keep capture/replay limited to local offline TAS sessions for now.

Verification risk
Mindustry’s InputHandler and DesktopInput combine raw events with gameplay controls. The first phase must prove a reliable injection point for each required action. Actions that cannot be replayed deterministically should be explicitly excluded from the first milestone.

---