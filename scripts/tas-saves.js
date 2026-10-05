"use strict";

const tasRootFolder = Vars.dataDirectory.child("tas");
const tasSavesFolder = tasRootFolder.child("saves");
const tasMetadataFolder = tasRootFolder.child("meta");

function ensureTasFolders() {
    if (!tasRootFolder.exists()) tasRootFolder.mkdirs();
    if (!tasSavesFolder.exists()) tasSavesFolder.mkdirs();
    if (!tasMetadataFolder.exists()) tasMetadataFolder.mkdirs();
}

function copySaveToTasFolder(sourceSlot) {
    ensureTasFolders();

    let sourceFile = sourceSlot.file;
    let baseName = sourceFile.nameWithoutExtension();
    let targetName = baseName + "-tas.msav";
    let targetFile = tasSavesFolder.child(targetName);
    let counter = 1;

    while (targetFile.exists()) {
        targetFile = tasSavesFolder.child(baseName + "-tas-" + counter + ".msav");
        counter++;
    }

    sourceSlot.exportFile(targetFile);

    let sourcePreviewFile = Vars.mapPreviewDirectory.child("save_slot_" + sourceFile.nameWithoutExtension() + ".png");
    let targetPreviewFile = tasMetadataFolder.child(targetFile.nameWithoutExtension() + ".png");
    if (targetPreviewFile.exists()) targetPreviewFile.delete();
    if (sourcePreviewFile.exists()) sourcePreviewFile.copyTo(targetPreviewFile);

    let metadata = {
        version: 1,
        sourceName: sourceFile.name(),
        sourcePath: sourceFile.absolutePath(),
        tasName: targetFile.name(),
        tasPath: targetFile.absolutePath(),
        tasDisplayName: sourceSlot.getName(),
        createdAt: new Date().toISOString()
    };

    let metadataFile = tasMetadataFolder.child(targetFile.nameWithoutExtension() + ".json");
    metadataFile.writeString(JSON.stringify(metadata, null, 2), false);
    return targetFile;
}

function deleteTasSave(file) {
    if (!file) return false;

    try {
        if (file.exists() && !file.delete()) {
            Vars.ui.showErrorMessage("Failed to delete TAS save.");
            return false;
        }
    } catch (error) {
        Vars.ui.showErrorMessage("Failed to delete TAS save: " + error);
        return false;
    }

    let metadataFile = tasMetadataFolder.child(file.nameWithoutExtension() + ".json");
    let previewFile = tasMetadataFolder.child(file.nameWithoutExtension() + ".png");
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

    let targetFile = tasSavesFolder.child(cleaned + ".msav");

    // Same name = nothing to do.
    if (file.nameWithoutExtension() === cleaned) return true;

    // Don't overwrite another TAS save.
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

        let oldMetadataFile = tasMetadataFolder.child(file.nameWithoutExtension() + ".json");
        let oldPreviewFile = tasMetadataFolder.child(file.nameWithoutExtension() + ".png");
        let newPreviewFile = tasMetadataFolder.child(targetFile.nameWithoutExtension() + ".png");
        let metadata = {};
        if (oldMetadataFile.exists()) {
            try {
                metadata = JSON.parse(oldMetadataFile.readString());
            } catch (error) {
                metadata = {};
            }
        }
        metadata.version = metadata.version || 1;
        metadata.tasDisplayName = cleaned;
        metadata.tasName = targetFile.name();
        metadata.tasPath = targetFile.absolutePath();
        tasMetadataFolder.child(targetFile.nameWithoutExtension() + ".json")
            .writeString(JSON.stringify(metadata, null, 2), false);
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

    let metadataFile = tasMetadataFolder.child(file.nameWithoutExtension() + ".json");
    if (metadataFile.exists()) {
        try {
            let metadata = JSON.parse(metadataFile.readString());
            if (metadata.tasDisplayName) return metadata.tasDisplayName;
        } catch (error) {
            // Fall back to the save filename when metadata is missing or invalid.
        }
    }

    let name = file.nameWithoutExtension();
    if (!name || name.length === 0) return "Untitled";
    return name;
}

exports.tasSavesFolder = tasSavesFolder;
exports.tasMetadataFolder = tasMetadataFolder;
exports.ensureTasFolders = ensureTasFolders;
exports.copySaveToTasFolder = copySaveToTasFolder;
exports.deleteTasSave = deleteTasSave;
exports.renameTasSave = renameTasSave;
exports.displayNameFor = displayNameFor;