"use strict";
// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.
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
exports.submitSolution = void 0;
const LeetCodeTreeDataProvider_1 = require("../explorer/LeetCodeTreeDataProvider");
const leetCodeExecutor_1 = require("../leetCodeExecutor");
const leetCodeManager_1 = require("../leetCodeManager");
const customTestcaseStore_1 = require("../utils/customTestcaseStore");
const problemUtils_1 = require("../utils/problemUtils");
const uiUtils_1 = require("../utils/uiUtils");
const workspaceUtils_1 = require("../utils/workspaceUtils");
const leetCodeSubmissionProvider_1 = require("../webview/leetCodeSubmissionProvider");
const TRUNCATED_TESTCASE_PATTERN = /\.\.\.\s+\d+\s+more character(?:s)?/i;
function submitSolution(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!leetCodeManager_1.leetCodeManager.getUser()) {
            uiUtils_1.promptForSignIn();
            return;
        }
        const filePath = yield workspaceUtils_1.getActiveFilePath(uri);
        if (!filePath) {
            return;
        }
        try {
            const result = yield leetCodeExecutor_1.leetCodeExecutor.submitSolution(filePath);
            yield saveFailedSubmissionTestcase(filePath, result);
            leetCodeSubmissionProvider_1.leetCodeSubmissionProvider.show(result);
        }
        catch (error) {
            leetCodeSubmissionProvider_1.leetCodeSubmissionProvider.show(formatSubmissionError(error));
            yield uiUtils_1.promptForOpenOutputChannel("Failed to submit the solution. Please open the output channel for details.", uiUtils_1.DialogType.error);
            return;
        }
        LeetCodeTreeDataProvider_1.leetCodeTreeDataProvider.refresh();
    });
}
exports.submitSolution = submitSolution;
function formatSubmissionError(error) {
    const message = cleanErrorMessage(error && error.result ? error.result : error);
    return `  ✘ Submission failed\n  ✘ Error: ${message}`;
}
function cleanErrorMessage(input) {
    const lines = String(input || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith("- Sending code to judge"))
        .filter((line) => !line.startsWith("- Waiting for judge result"))
        .filter((line) => !line.startsWith("(node:"))
        .filter((line) => !line.startsWith("(Use `node --trace-warnings"))
        .filter((line) => !line.includes("DeprecationWarning"));
    return lines[0] || "Unknown error";
}
function saveFailedSubmissionTestcase(filePath, raw) {
    return __awaiter(this, void 0, void 0, function* () {
        const parsed = parseResult(raw);
        const testcase = parsed.Testcase && parsed.Testcase[0];
        if (!testcase || TRUNCATED_TESTCASE_PATTERN.test(testcase)) {
            return;
        }
        const problemId = yield problemUtils_1.getNodeIdFromFile(filePath);
        if (!problemId) {
            return;
        }
        yield customTestcaseStore_1.saveProblemTestcase(filePath, problemId, testcase);
    });
}
function parseResult(raw) {
    raw = raw.concat("  √ ");
    const regSplit = /  [√×✔✘vx] ([^]+?)\n(?=  [√×✔✘vx] )/g;
    const regKeyVal = /(.+?): ([^]*)/;
    const result = { messages: [] };
    let entry;
    do {
        entry = regSplit.exec(raw);
        if (!entry) {
            continue;
        }
        const kvMatch = regKeyVal.exec(entry[1]);
        if (kvMatch) {
            const [key, value] = kvMatch.slice(1);
            if (value) {
                if (!result[key]) {
                    result[key] = [];
                }
                result[key].push(value);
            }
        }
        else {
            result.messages.push(entry[1]);
        }
    } while (entry);
    return result;
}
//# sourceMappingURL=submit.js.map
