"use strict";

const tasSaveStore = require("tas-saves");
const tasSavesFolder = tasSaveStore.tasSavesFolder;
const tasMetadataFolder = tasSaveStore.tasMetadataFolder;

let stepping = false;
let snapshotFile = Vars.dataDirectory.child("tas-snapshot.msav");
let snapshotKeys = ["f2", "f3", "f4", "f7", "f10"];

Core.settings.defaults("tas-save-key", "f10");
Core.settings.defaults("tas-load-key", "f7");

function listSaveFiles(dir) {
    if (!dir || !dir.exists()) return [];
    let files = dir.list();
    if (!files) return [];
    return files.filter(file => file.extension().toLowerCase() === "msav" || file.extension().toLowerCase() === "sav");
}

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
        let tasCopy = tasSaveStore.copySaveToTasFolder(saveSlot);
        print("Imported TAS copy: " + tasCopy.absolutePath());
        importer.hide();
        onDone();
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

    let previewFile = tasMetadataFolder.child(save.nameWithoutExtension() + ".png");
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

        let tasSaves = listSaveFiles(tasSavesFolder);
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
    }));

    Vars.ui.menufrag.addButton("Tool Assisted Speedrun", () => {
        openToolAssistedSpeedrunMenu();
    });
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
