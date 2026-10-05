"use strict";

const tasRootFolder = Vars.dataDirectory.child("tas");
const tasSavesFolder = tasRootFolder.child("saves");
const legacyMetadataFolder = tasRootFolder.child("meta");

function ensureTasFolders() {
    if (!tasRootFolder.exists()) tasRootFolder.mkdirs();
    if (!tasSavesFolder.exists()) tasSavesFolder.mkdirs();
    migrateLegacyTasSaves();
}

function isLegacyTasSave(file) {
    return file.parent().equals(tasSavesFolder);
}

function metadataFileFor(file) {
    if (isLegacyTasSave(file)) {
        return legacyMetadataFolder.child(file.nameWithoutExtension() + ".json");
    }
    return file.parent().child("tas.json");
}

function previewFileFor(file) {
    if (isLegacyTasSave(file)) {
        return legacyMetadataFolder.child(file.nameWithoutExtension() + ".png");
    }
    return file.parent().child("preview.png");
}

function readMetadata(file) {
    if (!file.exists()) return {};
    try {
        return JSON.parse(file.readString()) || {};
    } catch (error) {
        return {};
    }
}

function ensureMainBranch(projectFolder) {
    let branchFolder = projectFolder.child("branches").child("main");
    let savestatesFolder = branchFolder.child("savestates");
    if (!savestatesFolder.exists()) savestatesFolder.mkdirs();

    let branchMetadata = branchFolder.child("branch.json");
    if (!branchMetadata.exists()) {
        branchMetadata.writeString(JSON.stringify({
            version: 1,
            id: "main",
            parent: null,
            forkFrame: 0
        }, null, 2), false);
    }

    let inputsFile = branchFolder.child("inputs.json");
    if (!inputsFile.exists()) inputsFile.writeString("[]", false);
}

function createProjectFolder(baseName) {
    let safeName = sanitizeTasSaveName(baseName) || "TAS Save";
    let projectFolder = tasSavesFolder.child(safeName);
    let counter = 1;
    while (projectFolder.exists()) {
        projectFolder = tasSavesFolder.child(safeName + "-" + counter);
        counter++;
    }
    return projectFolder;
}

function findLegacyProjectFolder(legacyFile) {
    let safeName = "legacy-" + (sanitizeTasSaveName(legacyFile.nameWithoutExtension()) || "save");
    let projectFolder = tasSavesFolder.child(safeName);
    let counter = 1;

    while (projectFolder.exists()) {
        let metadata = readMetadata(projectFolder.child("tas.json"));
        let marker = readMetadata(projectFolder.child(".migration.json"));
        if (metadata.legacyFileName === legacyFile.name() || marker.legacyFileName === legacyFile.name()) {
            return projectFolder;
        }
        projectFolder = tasSavesFolder.child(safeName + "-" + counter);
        counter++;
    }
    return projectFolder;
}

function migrateLegacyTasSave(legacyFile) {
    let projectFolder = findLegacyProjectFolder(legacyFile);
    if (!projectFolder.exists()) projectFolder.mkdirs();

    let markerFile = projectFolder.child(".migration.json");
    if (!markerFile.exists()) {
        markerFile.writeString(JSON.stringify({ legacyFileName: legacyFile.name() }), false);
    }

    let saveFile = projectFolder.child("save.msav");
    if (saveFile.exists() && !SaveIO.isSaveValid(saveFile)) saveFile.delete();
    if (!saveFile.exists()) legacyFile.copyTo(saveFile);
    if (!saveFile.exists() || !SaveIO.isSaveValid(saveFile)) {
        throw new Error("Migrated save failed validation: " + legacyFile.name());
    }

    let oldMetadataFile = legacyMetadataFolder.child(legacyFile.nameWithoutExtension() + ".json");
    let metadata = readMetadata(projectFolder.child("tas.json"));
    if (Object.keys(metadata).length === 0) metadata = readMetadata(oldMetadataFile);
    let legacyMetadataCopy = projectFolder.child("legacy-meta.json");
    if (oldMetadataFile.exists() && Object.keys(metadata).length === 0 && !legacyMetadataCopy.exists()) {
        oldMetadataFile.copyTo(legacyMetadataCopy);
    }

    let oldPreviewFile = legacyMetadataFolder.child(legacyFile.nameWithoutExtension() + ".png");
    let previewFile = projectFolder.child("preview.png");
    if (oldPreviewFile.exists() && !previewFile.exists()) oldPreviewFile.copyTo(previewFile);

    ensureMainBranch(projectFolder);
    metadata.version = 2;
    metadata.tasId = projectFolder.name();
    metadata.saveFile = saveFile.name();
    metadata.tasName = saveFile.name();
    metadata.tasPath = saveFile.absolutePath();
    metadata.legacyFileName = legacyFile.name();
    if (!metadata.tasDisplayName) metadata.tasDisplayName = legacyFile.nameWithoutExtension();

    let metadataFile = projectFolder.child("tas.json");
    metadataFile.writeString(JSON.stringify(metadata, null, 2), false);
    markerFile.delete();

    if (legacyFile.delete()) {
        if (oldMetadataFile.exists()) oldMetadataFile.delete();
        if (oldPreviewFile.exists()) oldPreviewFile.delete();
    }
}

function migrateLegacyTasSaves() {
    let files = tasSavesFolder.list();
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        if (file.isDirectory()) continue;
        let extension = file.extension().toLowerCase();
        if (extension !== "msav" && extension !== "sav") continue;

        try {
            migrateLegacyTasSave(file);
        } catch (error) {
            print("Failed to migrate TAS save " + file.name() + ": " + error);
        }
    }
}

function listTasSaves() {
    ensureTasFolders();
    let saves = [];
    let migratedLegacyFiles = [];
    let files = tasSavesFolder.list();

    for (let i = 0; i < files.length; i++) {
        let entry = files[i];
        if (entry.isDirectory()) {
            let saveFile = entry.child("save.msav");
            if (saveFile.exists()) {
                saves.push(saveFile);
                let metadata = readMetadata(entry.child("tas.json"));
                if (metadata.legacyFileName) migratedLegacyFiles.push(metadata.legacyFileName);
            }
        }
    }

    for (let i = 0; i < files.length; i++) {
        let entry = files[i];
        if (entry.isDirectory()) continue;
        let extension = entry.extension().toLowerCase();
        if ((extension === "msav" || extension === "sav") && migratedLegacyFiles.indexOf(entry.name()) === -1) {
            saves.push(entry);
        }
    }
    return saves;
}

function copySaveToTasFolder(sourceSlot) {
    ensureTasFolders();

    let sourceFile = sourceSlot.file;
    let projectFolder = createProjectFolder(sourceFile.nameWithoutExtension() + "-tas");
    let targetFile = projectFolder.child("save.msav");

    try {
        projectFolder.mkdirs();
        sourceSlot.exportFile(targetFile);
        if (!SaveIO.isSaveValid(targetFile)) throw new Error("Exported TAS save failed validation.");

        let sourcePreviewFile = Vars.mapPreviewDirectory.child("save_slot_" + sourceFile.nameWithoutExtension() + ".png");
        let targetPreviewFile = projectFolder.child("preview.png");
        if (sourcePreviewFile.exists()) sourcePreviewFile.copyTo(targetPreviewFile);

        ensureMainBranch(projectFolder);
        let metadata = {
            version: 2,
            tasId: projectFolder.name(),
            saveFile: targetFile.name(),
            sourceName: sourceFile.name(),
            sourcePath: sourceFile.absolutePath(),
            tasName: targetFile.name(),
            tasPath: targetFile.absolutePath(),
            tasDisplayName: sourceSlot.getName(),
            createdAt: new Date().toISOString()
        };
        projectFolder.child("tas.json").writeString(JSON.stringify(metadata, null, 2), false);
        return targetFile;
    } catch (error) {
        try {
            if (projectFolder.exists()) projectFolder.deleteDirectory();
        } catch (cleanupError) {
            print("Failed to clean incomplete TAS folder: " + cleanupError);
        }
        throw error;
    }
}

function deleteTasSave(file) {
    if (!file) return false;

    if (!isLegacyTasSave(file)) {
        let projectFolder = file.parent();
        if (!projectFolder.parent().equals(tasSavesFolder)) return false;
        try {
            if (projectFolder.exists() && !projectFolder.deleteDirectory()) {
                Vars.ui.showErrorMessage("Failed to delete TAS save folder.");
                return false;
            }
        } catch (error) {
            Vars.ui.showErrorMessage("Failed to delete TAS save folder: " + error);
            return false;
        }
        return true;
    }

    try {
        if (file.exists() && !file.delete()) {
            Vars.ui.showErrorMessage("Failed to delete TAS save.");
            return false;
        }
    } catch (error) {
        Vars.ui.showErrorMessage("Failed to delete TAS save: " + error);
        return false;
    }

    let metadataFile = metadataFileFor(file);
    let previewFile = previewFileFor(file);
    let cleanupFailed = false;
    for (let sidecar of [metadataFile, previewFile]) {
        if (!sidecar.exists()) continue;
        try {
            if (!sidecar.delete()) cleanupFailed = true;
        } catch (error) {
            cleanupFailed = true;
        }
    }
    if (cleanupFailed) {
        Vars.ui.showErrorMessage("TAS save deleted, but some metadata could not be removed.");
    }
    return true;
}

function sanitizeTasSaveName(value) {
    let input = String(value || "");
    let cleaned = "";
    let previousWasSpace = false;

    for (let index = 0; index < input.length; index++) {
        let character = input.charAt(index);
        let code = input.charCodeAt(index);
        let allowed = (code >= 65 && code <= 90)
            || (code >= 97 && code <= 122)
            || (code >= 48 && code <= 57)
            || code === 32
            || code === 45
            || code === 95
            || code === 40
            || code === 41;

        if (!allowed) continue;
        if (code === 32) {
            if (!previousWasSpace) cleaned += character;
            previousWasSpace = true;
        } else {
            cleaned += character;
            previousWasSpace = false;
        }
    }

    return cleaned.trim();
}

function renameTasSave(file, newName) {
    if (!file || !file.exists()) return false;

    let cleaned = String(newName || "").trim();

    // Remove .msav if the user typed it manually.
    if (cleaned.toLowerCase().endsWith(".msav")) {
        cleaned = cleaned.substring(0, cleaned.length - 5).trim();
    }

    cleaned = sanitizeTasSaveName(cleaned);
    if (!cleaned) {
        Vars.ui.showErrorMessage("Invalid save name. Please enter a name.");
        return false;
    }

    if (displayNameFor(file) === cleaned) return true;

    if (!isLegacyTasSave(file)) {
        let metadataFile = metadataFileFor(file);
        let metadata = readMetadata(metadataFile);
        metadata.version = 2;
        metadata.tasId = file.parent().name();
        metadata.saveFile = file.name();
        metadata.tasName = file.name();
        metadata.tasPath = file.absolutePath();
        metadata.tasDisplayName = cleaned;

        try {
            metadataFile.writeString(JSON.stringify(metadata, null, 2), false);
            return true;
        } catch (error) {
            Vars.ui.showErrorMessage("Failed to rename TAS save: " + error);
            return false;
        }
    }

    let targetFile = tasSavesFolder.child(cleaned + ".msav");
    if (file.nameWithoutExtension() === cleaned) return true;
    if (targetFile.exists() && !targetFile.equals(file)) {
        Vars.ui.showErrorMessage("A TAS save with that name already exists.");
        return false;
    }

    try {
        file.moveTo(targetFile);

        if (!targetFile.exists()) {
            Vars.ui.showErrorMessage("Failed to rename TAS save.");
            return false;
        }

        let oldMetadataFile = metadataFileFor(file);
        let oldPreviewFile = previewFileFor(file);
        let newMetadataFile = metadataFileFor(targetFile);
        let newPreviewFile = previewFileFor(targetFile);
        let metadata = readMetadata(oldMetadataFile);
        metadata.version = metadata.version || 1;
        metadata.tasDisplayName = cleaned;
        metadata.tasName = targetFile.name();
        metadata.tasPath = targetFile.absolutePath();
        newMetadataFile.writeString(JSON.stringify(metadata, null, 2), false);
        if (oldMetadataFile.exists()) oldMetadataFile.delete();
        if (newPreviewFile.exists()) newPreviewFile.delete();
        if (oldPreviewFile.exists()) oldPreviewFile.moveTo(newPreviewFile);

        return true;
    } catch (error) {
        Vars.ui.showErrorMessage("Failed to rename TAS save: " + error);
        return false;
    }
}

function displayNameFor(file) {
    if (!file) return "Untitled";

    let metadataFile = metadataFileFor(file);
    if (metadataFile.exists()) {
        try {
            let metadata = JSON.parse(metadataFile.readString());
            if (metadata.tasDisplayName) return metadata.tasDisplayName;
        } catch (error) {
            // Fall back to the save filename when metadata is missing or invalid.
        }
    }

    let name = isLegacyTasSave(file) ? file.nameWithoutExtension() : file.parent().name();
    if (!name || name.length === 0) return "Untitled";
    return name;
}

exports.tasSavesFolder = tasSavesFolder;
exports.ensureTasFolders = ensureTasFolders;
exports.listTasSaves = listTasSaves;
exports.previewFileFor = previewFileFor;
exports.copySaveToTasFolder = copySaveToTasFolder;
exports.deleteTasSave = deleteTasSave;
exports.renameTasSave = renameTasSave;
exports.displayNameFor = displayNameFor;