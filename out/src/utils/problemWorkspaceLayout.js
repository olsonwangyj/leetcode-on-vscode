"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.finishProblemWorkspace = exports.openProblemCodeEditor = exports.prepareProblemPresentation = void 0;
const vscode = require("vscode");
const forkConfig = require("./forkConfig");
function prepareProblemPresentation(showDescriptionInWebview, showDescription) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!showDescriptionInWebview) {
            return;
        }
        yield vscode.commands.executeCommand("vscode.setEditorLayout", {
            orientation: 0,
            groups: forkConfig.getProblemEditorGroups(),
        });
        yield showDescription();
    });
}
exports.prepareProblemPresentation = prepareProblemPresentation;
function openProblemCodeEditor(finalPath, showDescriptionInWebview) {
    return __awaiter(this, void 0, void 0, function* () {
        return vscode.window.showTextDocument(vscode.Uri.file(finalPath), {
            preview: false,
            viewColumn: showDescriptionInWebview ? vscode.ViewColumn.Two : vscode.ViewColumn.One,
        });
    });
}
exports.openProblemCodeEditor = openProblemCodeEditor;
function finishProblemWorkspace(finalPath, workspaceFolder, closeOtherTabs) {
    return __awaiter(this, void 0, void 0, function* () {
        yield closeOtherTabs(finalPath, workspaceFolder);
        if (forkConfig.shouldAutoCollapseSidebar()) {
            yield vscode.commands.executeCommand("workbench.action.closeSidebar");
        }
    });
}
exports.finishProblemWorkspace = finishProblemWorkspace;

