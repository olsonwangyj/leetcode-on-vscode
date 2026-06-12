"use strict";
// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.codeLensController = void 0;
const vscode_1 = require("vscode");
const timer_1 = require("../commands/timer");
const CustomCodeLensProvider_1 = require("./CustomCodeLensProvider");
class CodeLensController {
    constructor() {
        this.internalProvider = CustomCodeLensProvider_1.customCodeLensProvider;
        this.configurationChangeListener = vscode_1.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration("leetcode.editor.shortcuts") || event.affectsConfiguration("leetcode.problemTimer.enabled")) {
                this.internalProvider.refresh();
            }
        }, this);
        this.timerChangeListener = timer_1.problemTimer.onDidChangeTimer(() => this.internalProvider.refresh(), this);
        this.registeredProvider = vscode_1.languages.registerCodeLensProvider({ scheme: "file" }, this.internalProvider);
    }
    refresh() {
        this.internalProvider.refresh();
    }
    dispose() {
        if (this.registeredProvider) {
            this.registeredProvider.dispose();
        }
        this.configurationChangeListener.dispose();
        this.timerChangeListener.dispose();
    }
}
exports.codeLensController = new CodeLensController();
//# sourceMappingURL=CodeLensController.js.map
