"use strict";

const tasSaveStore = require("tas-saves");

let stepping = false;
let inTasSession = false;
let snapshotFile = Vars.dataDirectory.child("tas-snapshot.msav");
let snapshotKeys = ["f2", "f3", "f4", "f7", "f10"];
let tasControlPanel;
let tasPanelContent;
let tasPanelControlSignature;
let tasPanelScale;
let tasPanelOpacity;

const tasPanelSettings = {
    pause: "tas-panel-show-pause",
    step: "tas-panel-show-step",
    save: "tas-panel-show-save",
    load: "tas-panel-show-load",
    scale: "tas-panel-scale",
    opacity: "tas-panel-opacity"
};

Core.settings.defaults("tas-save-key", "f10");
Core.settings.defaults("tas-load-key", "f7");
Core.settings.defaults(tasPanelSettings.pause, true);
Core.settings.defaults(tasPanelSettings.step, true);
Core.settings.defaults(tasPanelSettings.save, true);
Core.settings.defaults(tasPanelSettings.load, true);
Core.settings.defaults(tasPanelSettings.scale, 100);
Core.settings.defaults(tasPanelSettings.opacity, 100);

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

function tasPanelControlsEnabled() {
    return [
        Core.settings.getBool(tasPanelSettings.pause),
        Core.settings.getBool(tasPanelSettings.step),
        Core.settings.getBool(tasPanelSettings.save),
        Core.settings.getBool(tasPanelSettings.load)
    ];
}

function rebuildTasPanelContent() {
    tasPanelContent.clearChildren();
    tasPanelContent.defaults().size(158, 42).pad(3);

    let controls = tasPanelControlsEnabled();
    let count = 0;
    let addControl = (enabled, label, action) => {
        if (!enabled) return;
        tasPanelContent.button(label, action);
        count++;
        if (count % 2 === 0) tasPanelContent.row();
    };

    addControl(controls[0], "Pause / Resume", toggleTasPause);
    addControl(controls[1], "Step One Tick", stepTasOneTick);
    addControl(controls[2], "Save Snapshot", saveTasSnapshot);
    addControl(controls[3], "Load Snapshot", loadTasSnapshot);

    tasPanelControlSignature = controls.join(":");
}

function clampTasPanelPosition() {
    if (!tasControlPanel) return;

    let scale = tasPanelScale || 1;
    let maxX = Math.max(0, Core.graphics.getWidth() - tasControlPanel.getWidth() * scale);
    let maxY = Math.max(0, Core.graphics.getHeight() - tasControlPanel.getHeight() * scale);
    let x = Math.max(0, Math.min(tasControlPanel.getX(Align.bottomLeft), maxX));
    let y = Math.max(0, Math.min(tasControlPanel.getY(Align.bottomLeft), maxY));
    tasControlPanel.setPosition(x, y);
}

function refreshTasControlPanel() {
    if (!tasControlPanel) return;

    tasControlPanel.visible = inTasSession;

    let controls = tasPanelControlsEnabled();
    let controlSignature = controls.join(":");
    if (controlSignature !== tasPanelControlSignature) rebuildTasPanelContent();

    let scale = Core.settings.getInt(tasPanelSettings.scale) / 100;
    if (scale !== tasPanelScale) {
        tasPanelScale = scale;
        tasControlPanel.setScale(scale);
        clampTasPanelPosition();
    }

    let opacity = Core.settings.getInt(tasPanelSettings.opacity) / 100;
    if (opacity !== tasPanelOpacity) {
        tasPanelOpacity = opacity;
        tasControlPanel.setColor(1, 1, 1, opacity);
    }
}

function openTasSettings() {
    let settings = Vars.ui.settings;
    settings.show();

    Core.app.post(() => {
        let categories = settings.getCategories();
        let tasCategory = null;
        for (let i = 0; i < categories.size; i++) {
            let category = categories.get(i);
            if (category.name === "Tool Assisted Speedrun") {
                tasCategory = category;
                break;
            }
        }
        if (!tasCategory) return;

        let settingsChildren = settings.cont.getChildren();
        if (settingsChildren.size === 0) return;
        let preferences = settingsChildren.get(0).getWidget();
        preferences.clearChildren();
        preferences.add(tasCategory.table);
    });
}

function createTasControlPanel() {
    tasControlPanel = new Table(Tex.pane);
    tasControlPanel.setSize(340, 158);
    tasControlPanel.setTransform(true);
    tasControlPanel.setOrigin(Align.bottomLeft);
    tasControlPanel.defaults().pad(5);

    let titleBar = new Table(Styles.grayPanel);
    titleBar.defaults().height(36).pad(3);
    let titleLabel = titleBar.add("TAS Controls").growX().left().get();
    titleBar.button(Icon.settings, Styles.defaulti, openTasSettings).size(40);
    let moveButton = titleBar.button("Move", Styles.grayt, () => {}).size(72, 34).get();
    moveButton.addListener(new JavaAdapter(DragListener, {
        drag: function(event, x, y) {
            tasControlPanel.moveBy(-this.getDeltaX(), -this.getDeltaY());
            clampTasPanelPosition();
        }
    }));

    tasPanelContent = new Table();
    tasPanelContent.background(Styles.black8);
    tasControlPanel.add(titleBar).growX().height(36).row();
    tasControlPanel.add(tasPanelContent).grow().pad(5);
    tasControlPanel.update(() => refreshTasControlPanel());
    Vars.ui.hudGroup.addChild(tasControlPanel);
    tasControlPanel.setPosition(12, 12, Align.bottomLeft);
    refreshTasControlPanel();
}

function toggleTasPause() {
    if (!Vars.state.isGame() || Vars.net.active()) return;
    Vars.state.set(Vars.state.isPaused() ? GameState.State.playing : GameState.State.paused);
}

function stepTasOneTick() {
    if (!Vars.state.isGame() || Vars.net.active() || !Vars.state.isPaused()) return;
    stepping = true;
    Vars.state.set(GameState.State.playing);
}

function saveTasSnapshot() {
    if (!Vars.state.isGame() || Vars.net.active() || !Vars.state.isPaused()) return;
    try {
        SaveIO.save(snapshotFile);
        print("TAS snapshot saved: " + snapshotFile.absolutePath());
    } catch (error) {
        print("TAS snapshot save failed: " + error);
    }
}

function loadTasSnapshot() {
    if (!Vars.state.isGame() || Vars.net.active() || !Vars.state.isPaused()) return;
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
}

function buildImportCard(saveSlot, importer, onDone) {
    let card = new Table();
    card.defaults().left().pad(4);

    let button = new TextButton("", Styles.grayt);
    button.setDisabled(false);
    button.clearChildren();
    button.defaults().left();
    button.left();
    button.table(cons(title => {
        title.add("[accent]" + saveSlot.getName()).left().growX().width(220).wrap();
        title.table(cons(opts => {
            opts.right();
            opts.defaults().size(38);
        })).padRight(-10).growX();
    })).growX().colspan(2);
    button.row();

    let previewRegion = saveSlot.previewTexture();
    if (previewRegion == null) previewRegion = Core.atlas.find("nomap");
    let previewImage = new BorderImage(previewRegion, 4);
    previewImage.update(() => {
        let currentTexture = saveSlot.previewTexture();
        if (currentTexture != null && currentTexture !== previewRegion) {
            previewRegion = currentTexture;
            previewImage.setDrawable(new TextureRegion(currentTexture));
        }
    });
    button.left().add(previewImage).size(160, 120).padRight(6);
    button.table(cons(meta => {
        meta.left().top();
        meta.defaults().padBottom(-2).left().width(260);
        meta.row();
        meta.labelWrap("Map: " + (saveSlot.file.name().includes("backup") ? "Backup copy" : "Save slot"));
        meta.row();
        meta.labelWrap("Autosave: On");
        meta.row();
        meta.labelWrap("Playtime: Unknown");
    })).left().growX().width(260);

    button.clicked(() => {
        try {
            let tasCopy = tasSaveStore.copySaveToTasFolder(saveSlot);
            print("Imported TAS copy: " + tasCopy.absolutePath());
            importer.hide();
            onDone();
        } catch (error) {
            Vars.ui.showErrorMessage("Failed to import TAS save: " + error);
        }
    });

    return button;
}

function buildTasCard(save, dialog, onRefresh) {
    let button = new TextButton("", Styles.grayt);
    button.clearChildren();
    button.left();
    button.defaults().left();
    button.table(cons(title => {
        title.add("[accent]" + tasSaveStore.displayNameFor(save)).left().growX().width(220).wrap();
        title.table(cons(opts => {
            opts.right();
            opts.defaults().size(38);
            opts.button(Icon.pencil, Styles.emptyi, () => {
                Vars.ui.showTextInput("Rename TAS Save", "New name", 30, tasSaveStore.displayNameFor(save), newName => {
                    let renamed = tasSaveStore.renameTasSave(save, newName);
                    if (renamed) onRefresh();
                });
            }).right();
            opts.button(Icon.trash, Styles.emptyi, () => {
                Vars.ui.showConfirm("Delete TAS Save", "Are you sure you want to delete this TAS save?", () => {
                    if (tasSaveStore.deleteTasSave(save)) onRefresh();
                });
            });
        })).padRight(-10).growX();
    })).growX().colspan(2);
    button.row();

    let previewFile = tasSaveStore.previewFileFor(save);
    let previewImage = new BorderImage(Core.atlas.find("nomap"), 4);
    if (previewFile.exists()) {
        try {
            let previewTexture = new Texture(previewFile);
            previewImage = new BorderImage(previewTexture, 4);
        } catch (error) {
            print("Failed to load TAS preview: " + error);
        }
    }
    button.left().add(previewImage).size(160, 120).padRight(6);
    button.table(cons(meta => {
        meta.left().top();
        meta.defaults().padBottom(-2).left().width(260);
        meta.row();
        meta.labelWrap("Map: TAS copy");
        meta.row();
        meta.labelWrap("Autosave: On");
        meta.row();
        meta.labelWrap("Playtime: Unknown");
    })).left().growX().width(260);

    button.clicked(() => {
        if (button.childrenPressed()) return;

        try {
            SaveIO.load(save);
            inTasSession = true;
            Vars.state.set(GameState.State.paused);
            print("Loaded TAS save: " + save.absolutePath());
            dialog.hide();
        } catch (error) {
            print("Failed to load TAS save: " + error);
        }
    });

    return button;
}

function showTasImportDialog() {
    let importer = new BaseDialog("Load Game");
    importer.setKeepWithinStage(true);
    importer.setMovable(true);
    importer.setResizable(false);
    importer.setSize(Math.min(Core.graphics.getWidth() * 0.8, 1100), Math.min(Core.graphics.getHeight() * 0.82, 700));

    let content = new Table();
    content.defaults().pad(10);

    let saveSlots = Vars.control.saves.getSaveSlots();
    if (!saveSlots || saveSlots.size === 0) {
        content.add("No saves found in the Load Game folder.").color(Color.lightGray).row();
    } else {
        for (let i = 0; i < saveSlots.size; i++) {
            let saveSlot = saveSlots.get(i);
            let card = buildImportCard(saveSlot, importer, () => openToolAssistedSpeedrunMenu());
            content.add(card).uniformX().fillX().pad(4).padRight(8).margin(10);
            if ((i + 1) % 3 === 0) content.row();
        }
    }

    importer.cont.clear();
    importer.cont.add("Load Game").row();
    importer.cont.pane(content).grow().maxHeight(Core.graphics.getHeight() * 0.7).get().setScrollingDisabled(true, false);
    importer.buttons.defaults().pad(8).height(46);
    importer.buttons.button("Back", () => {
        importer.hide();
        openToolAssistedSpeedrunMenu();
    });
    importer.show();
}

function openToolAssistedSpeedrunMenu() {
    tasSaveStore.ensureTasFolders();

    let dialog = new BaseDialog("Tool Assisted Speedrun");
    dialog.setKeepWithinStage(true);
    dialog.setMovable(true);
    dialog.setResizable(false);
    dialog.setSize(Math.min(Core.graphics.getWidth() * 0.7, 900), Math.min(Core.graphics.getHeight() * 0.7, 600));

    let rebuild = () => {
        dialog.cont.clear();
        dialog.cont.defaults().pad(6).left();

        let tasSaves = tasSaveStore.listTasSaves();
        let list = new Table();
        list.defaults().pad(10).left();

        if (tasSaves.length === 0) {
            list.add("No TAS saves imported yet.").color(Color.lightGray).growX().row();
        } else {
            for (let i = 0; i < tasSaves.length; i++) {
                let save = tasSaves[i];
                let card = buildTasCard(save, dialog, rebuild);
                list.add(card).uniformX().fillX().pad(4).padRight(8).margin(10);
                if ((i + 1) % 3 === 0) list.row();
            }
        }

        dialog.cont.add("Original saves are never modified. TAS saves are copied into a separate folder.").color(Color.lightGray).growX().row();
        dialog.cont.row();
        dialog.cont.pane(list).grow().maxHeight(Core.graphics.getHeight() * 0.45).get().setScrollingDisabled(true, false);
        dialog.cont.row();
        dialog.cont.button("Import Save", () => {
            dialog.hide();
            showTasImportDialog();
        }).width(220).height(48);
        dialog.cont.row();
        dialog.cont.button("Close", () => dialog.hide()).width(220).height(48);
    };

    rebuild();
    dialog.show();
}

Events.on(ClientLoadEvent, () => {
    Vars.ui.settings.addCategory("Tool Assisted Speedrun", cons(table => {
        addSnapshotKeyOption(table, "tas-save-key", "tas-load-key", "Save Snapshot Key");
        addSnapshotKeyOption(table, "tas-load-key", "tas-save-key", "Load Snapshot Key");
        table.checkPref(tasPanelSettings.pause, true);
        table.checkPref(tasPanelSettings.step, true);
        table.checkPref(tasPanelSettings.save, true);
        table.checkPref(tasPanelSettings.load, true);
        table.sliderPref(tasPanelSettings.scale, 100, 50, 150, 10, value => value + "%");
        table.sliderPref(tasPanelSettings.opacity, 100, 20, 100, 10, value => value + "%");
    }));

    Vars.ui.menufrag.addButton("Tool Assisted Speedrun", () => {
        openToolAssistedSpeedrunMenu();
    });

    createTasControlPanel();
});

Events.run(Trigger.update, () => {
    if (!Vars.state.isGame()) inTasSession = false;
    refreshTasControlPanel();

    if (!Vars.state.isGame() || Vars.net.active()) return;

    if (Vars.state.isPaused() && Core.input.keyTap(KeyCode.valueOf(Core.settings.getString("tas-save-key")))) {
        saveTasSnapshot();
        return;
    }

    if (Vars.state.isPaused() && Core.input.keyTap(KeyCode.valueOf(Core.settings.getString("tas-load-key")))) {
        loadTasSnapshot();
        return;
    }

    if (Core.input.keyTap(KeyCode.f8)) {
        toggleTasPause();
        return;
    }

    if (Vars.state.isPaused() && Core.input.keyTap(KeyCode.f9)) {
        stepTasOneTick();
    }
});

Events.run(Trigger.afterGameUpdate, () => {
    if (stepping) {
        stepping = false;
        if (Vars.state.isPlaying()) Vars.state.set(GameState.State.paused);
    }
});
