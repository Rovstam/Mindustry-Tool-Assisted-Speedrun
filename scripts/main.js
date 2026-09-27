"use strict";

let stepping = false;
let snapshotFile = Vars.dataDirectory.child("tas-snapshot.msav");
let snapshotKeys = ["f2", "f3", "f4", "f7", "f10"];

Core.settings.defaults("tas-save-key", "f10");
Core.settings.defaults("tas-load-key", "f7");

function addSnapshotKeyOption(table, setting, otherSetting, label) {
    let button;
    let updateLabel = () => {
        button.getLabel().setText(label + ": " + Core.settings.getString(setting).toUpperCase());
    };

    button = table.button("", () => {
        let currentIndex = snapshotKeys.indexOf(Core.settings.getString(setting));
        let otherKey = Core.settings.getString(otherSetting);

        for (let offset = 1; offset <= snapshotKeys.length; offset++) {
            let candidate = snapshotKeys[(currentIndex + offset + snapshotKeys.length) % snapshotKeys.length];
            if (candidate !== otherKey) {
                Core.settings.put(setting, candidate);
                break;
            }
        }

        updateLabel();
    }).width(360).height(50).get();

    updateLabel();
    table.row();
}

Events.on(ClientLoadEvent, () => {
    Vars.ui.settings.addCategory("Tool Assisted Speedrun", cons(table => {
        addSnapshotKeyOption(table, "tas-save-key", "tas-load-key", "Save Snapshot Key");
        addSnapshotKeyOption(table, "tas-load-key", "tas-save-key", "Load Snapshot Key");
    }));
});

Events.run(Trigger.update, () => {
    if (!Vars.state.isGame() || Vars.net.active()) return;

    if (Vars.state.isPaused() && Core.input.keyTap(KeyCode.valueOf(Core.settings.getString("tas-save-key")))) {
        try {
            SaveIO.save(snapshotFile);
            print("TAS snapshot saved: " + snapshotFile.absolutePath());
        } catch (error) {
            print("TAS snapshot save failed: " + error);
        }
        return;
    }

    if (Vars.state.isPaused() && Core.input.keyTap(KeyCode.valueOf(Core.settings.getString("tas-load-key")))) {
        if (!snapshotFile.exists()) {
            print("No TAS snapshot found to load.");
            return;
        }
        try {
            SaveIO.load(snapshotFile);
            Vars.state.set(GameState.State.paused);
            print("TAS snapshot loaded.");
        } catch (error) {
            print("TAS snapshot load failed: " + error);
        }
        return;
    }

    if (Core.input.keyTap(KeyCode.f8)) {
        Vars.state.set(Vars.state.isPaused() ? GameState.State.playing : GameState.State.paused);
        return;
    }

    if (Vars.state.isPaused() && Core.input.keyTap(KeyCode.f9)) {
        stepping = true;
        Vars.state.set(GameState.State.playing);
    }
});

Events.run(Trigger.afterGameUpdate, () => {
    if (stepping) {
        stepping = false;
        if (Vars.state.isPlaying()) Vars.state.set(GameState.State.paused);
    }
});