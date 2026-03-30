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
exports.testSolutionDirect = exports.testSolution = void 0;
const fse = require("fs-extra");
const he = require("he");
const vscode = require("vscode");
const leetCodeExecutor_1 = require("../leetCodeExecutor");
const leetCodeManager_1 = require("../leetCodeManager");
const shared_1 = require("../shared");
const osUtils_1 = require("../utils/osUtils");
const customTestcaseStore_1 = require("../utils/customTestcaseStore");
const problemUtils_1 = require("../utils/problemUtils");
const settingUtils = require("../utils/settingUtils");
const uiUtils_1 = require("../utils/uiUtils");
const workspaceUtils_1 = require("../utils/workspaceUtils");
const wsl = require("../utils/wslUtils");
const leetCodeSubmissionProvider_1 = require("../webview/leetCodeSubmissionProvider");
const INTER_TEST_DELAY_MS = 3000;
const RATE_LIMIT_RETRY_DELAYS_MS = [5000, 10000, 15000];
function showResult(result) {
    if (!result) {
        return;
    }
    if (/^\s*[√×✔✘vx]\s+Test failed\s*$/m.test(result) && !/\n\s*[√×✔✘vx]\s+Error: /.test(result)) {
        result = `${String(result).trim()}\n  ✘ Error: No detailed error was returned. Open the LeetCode output channel to inspect the raw command output.`;
    }
    if (!/  [√×✔✘vx] /.test(result)) {
        const message = String(result).trim().replace(/\r?\n+/g, " ").trim() || "Unknown error";
        result = `  ✘ Test failed\n  ✘ Error: ${message}`;
    }
    leetCodeSubmissionProvider_1.leetCodeSubmissionProvider.show(result);
}
function getActiveFilePath(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        if (leetCodeManager_1.leetCodeManager.getStatus() === shared_1.UserStatus.SignedOut) {
            return;
        }
        return yield workspaceUtils_1.getActiveFilePath(uri);
    });
}
function testSolutionDirect(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const filePath = yield getActiveFilePath(uri);
            if (!filePath) {
                return;
            }
            const testCases = yield getTestCases(filePath);
            if (!testCases.length) {
                const result = yield leetCodeExecutor_1.leetCodeExecutor.testSolution(filePath);
                showResult(result);
                return;
            }
            const results = [];
            let stoppedEarlyReason = "";
            yield vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, (progress) => __awaiter(this, void 0, void 0, function* () {
                for (let i = 0; i < testCases.length; i++) {
                    progress.report({ message: `Running ${testCases[i].label} (${i + 1}/${testCases.length})` });
                    try {
                        results.push({
                            label: testCases[i].label,
                            raw: yield runTestWithInput(filePath, testCases[i].input, progress, testCases[i].label),
                        });
                    }
                    catch (error) {
                        const cleanMessage = cleanErrorMessage(error && error.result ? error.result : error);
                        results.push({
                            label: testCases[i].label,
                            raw: formatStructuredError(testCases[i].label, cleanMessage),
                        });
                        if (isRateLimitError(error)) {
                            stoppedEarlyReason = `LeetCode rate limited the remaining tests after ${testCases[i].label}.`;
                        }
                        else {
                            stoppedEarlyReason = `Testing stopped at ${testCases[i].label}.`;
                        }
                        break;
                    }
                    if (i < testCases.length - 1) {
                        progress.report({
                            message: `Waiting ${Math.ceil(INTER_TEST_DELAY_MS / 1000)}s before ${testCases[i + 1].label} to avoid rate limits`,
                        });
                        yield sleep(INTER_TEST_DELAY_MS);
                    }
                }
            }));
            const result = formatTestResults(results, testCases.length, stoppedEarlyReason);
            showResult(result);
        }
        catch (error) {
            if (error.result) {
                showResult(error.result);
                return;
            }
            yield uiUtils_1.promptForOpenOutputChannel("Failed to test the solution. Please open the output channel for details.", uiUtils_1.DialogType.error);
        }
    });
}
exports.testSolutionDirect = testSolutionDirect;
function testSolution(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const filePath = yield getActiveFilePath(uri);
            if (!filePath) {
                return;
            }
            const picks = [];
            picks.push({
                label: "$(three-bars) Default test cases",
                description: "",
                detail: "Test with the default cases",
                value: ":default",
            }, {
                label: "$(pencil) Write directly...",
                description: "",
                detail: "Write test cases in input box",
                value: ":direct",
            }, {
                label: "$(file-text) Browse...",
                description: "",
                detail: "Test with the written cases in file",
                value: ":file",
            });
            const choice = yield vscode.window.showQuickPick(picks);
            if (!choice) {
                return;
            }
            let result;
            switch (choice.value) {
                case ":default":
                    result = yield leetCodeExecutor_1.leetCodeExecutor.testSolution(filePath);
                    break;
                case ":direct":
                    const testString = yield vscode.window.showInputBox({
                        prompt: "Enter the test cases.",
                        validateInput: (s) => s && s.trim() ? undefined : "Test case must not be empty.",
                        placeHolder: "Example: [1,2,3]\\n4",
                        ignoreFocusOut: true,
                    });
                    if (testString) {
                        result = yield leetCodeExecutor_1.leetCodeExecutor.testSolution(filePath, parseTestString(testString));
                    }
                    break;
                case ":file":
                    const testFile = yield uiUtils_1.showFileSelectDialog(filePath);
                    if (testFile && testFile.length) {
                        const input = (yield fse.readFile(testFile[0].fsPath, "utf-8")).trim();
                        if (input) {
                            result = yield leetCodeExecutor_1.leetCodeExecutor.testSolution(filePath, parseTestString(input.replace(/\r?\n/g, "\\n")));
                        }
                        else {
                            vscode.window.showErrorMessage("The selected test file must not be empty.");
                        }
                    }
                    break;
                default:
                    break;
            }
            showResult(result);
        }
        catch (error) {
            yield uiUtils_1.promptForOpenOutputChannel("Failed to test the solution. Please open the output channel for details.", uiUtils_1.DialogType.error);
        }
    });
}
exports.testSolution = testSolution;
function getTestCases(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const problemId = yield problemUtils_1.getNodeIdFromFile(filePath);
        if (!problemId) {
            return [];
        }
        const description = yield leetCodeExecutor_1.leetCodeExecutor.getDescription(problemId, settingUtils.shouldUseEndpointTranslation());
        const exampleInputs = extractExampleInputs(description).map((input, index) => ({
            label: `Example ${index + 1}`,
            input,
        }));
        const savedInputs = (yield customTestcaseStore_1.loadProblemTestcases(filePath, problemId))
            .filter((input) => !exampleInputs.some((example) => normalizeStoredInput(example.input) === normalizeStoredInput(input)))
            .map((input, index) => ({
            label: `Failed Case ${index + 1}`,
            input,
        }));
        return exampleInputs.concat(savedInputs);
    });
}
function normalizeStoredInput(input) {
    return String(input || "").replace(/\r\n/g, "\n").trim();
}
function extractExampleInputs(description) {
    const inputs = [];
    const exampleReg = /<p><strong class="example">Example\s+\d+:\s*<\/strong><\/p>\s*<pre>([\s\S]*?)<\/pre>/gi;
    let example;
    while ((example = exampleReg.exec(description)) !== null) {
        const inputMatch = example[1].match(/<strong>Input:<\/strong>\s*([\s\S]*?)(?=\s*<strong>Output:<\/strong>)/i);
        if (!inputMatch) {
            continue;
        }
        const normalizedInput = normalizeExampleInput(inputMatch[1]);
        if (normalizedInput) {
            inputs.push(normalizedInput);
        }
    }
    return inputs;
}
function normalizeExampleInput(rawInput) {
    const input = he.decode(rawInput.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\u00a0/g, " ").replace(/[ \t]*\n[ \t]*/g, " ").trim();
    if (!input) {
        return "";
    }
    const parts = splitTopLevel(input);
    if (parts.length === 1 && findTopLevelEquals(parts[0]) < 0) {
        return parts[0].trim();
    }
    return parts.map((part) => {
        const equalsIndex = findTopLevelEquals(part);
        return equalsIndex >= 0 ? part.slice(equalsIndex + 1).trim() : part.trim();
    }).filter(Boolean).join("\n");
}
function splitTopLevel(input) {
    const parts = [];
    let current = "";
    let quote = "";
    let escaped = false;
    const stack = [];
    for (const ch of input) {
        if (quote) {
            current += ch;
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === quote) {
                quote = "";
            }
            continue;
        }
        if (ch === "\"" || ch === "'") {
            quote = ch;
            current += ch;
            continue;
        }
        if (ch === "[" || ch === "{" || ch === "(") {
            stack.push(ch);
            current += ch;
            continue;
        }
        if (ch === "]" || ch === "}" || ch === ")") {
            if (stack.length) {
                stack.pop();
            }
            current += ch;
            continue;
        }
        if (ch === "," && stack.length === 0) {
            if (current.trim()) {
                parts.push(current.trim());
            }
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim()) {
        parts.push(current.trim());
    }
    return parts;
}
function findTopLevelEquals(input) {
    let quote = "";
    let escaped = false;
    const stack = [];
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quote) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === quote) {
                quote = "";
            }
            continue;
        }
        if (ch === "\"" || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === "[" || ch === "{" || ch === "(") {
            stack.push(ch);
            continue;
        }
        if (ch === "]" || ch === "}" || ch === ")") {
            if (stack.length) {
                stack.pop();
            }
            continue;
        }
        if (ch === "=" && stack.length === 0) {
            return i;
        }
    }
    return -1;
}
function runTestWithInput(filePath, testInput, progress, label) {
    return __awaiter(this, void 0, void 0, function* () {
        const stdinInput = testInput.endsWith("\n") ? testInput : `${testInput}\n`;
        for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt++) {
            try {
                return yield leetCodeExecutor_1.leetCodeExecutor.executeCommandEx(leetCodeExecutor_1.leetCodeExecutor.node, [
                    yield leetCodeExecutor_1.leetCodeExecutor.getLeetCodeBinaryPath(),
                    "test",
                    `"${filePath}"`,
                    "-i",
                ], { shell: true, stdin: stdinInput });
            }
            catch (error) {
                if (!isRateLimitError(error) || attempt === RATE_LIMIT_RETRY_DELAYS_MS.length) {
                    throw error;
                }
                if (progress) {
                    progress.report({
                        message: `${label || "Current case"} hit rate limit, retrying in ${Math.ceil(RATE_LIMIT_RETRY_DELAYS_MS[attempt] / 1000)}s`,
                    });
                }
                yield sleep(RATE_LIMIT_RETRY_DELAYS_MS[attempt]);
            }
        }
        return "";
    });
}
function formatTestResults(results, totalCount, stoppedEarlyReason = "") {
    const passed = results.filter((result) => {
        const firstMarkedLine = extractMarkedEntries(result.raw)[0];
        return !!firstMarkedLine && isSuccessIcon(firstMarkedLine.icon);
    }).length;
    const processedCount = totalCount || results.length;
    const summaryIcon = passed === processedCount && !stoppedEarlyReason ? "✔" : "✘";
    const lines = [`  ${summaryIcon} Test cases (${passed}/${processedCount} passed)`];
    if (stoppedEarlyReason) {
        lines.push(`  ✘ Notice: ${stoppedEarlyReason}`);
    }
    results.forEach((result) => {
        const entries = extractMarkedEntries(result.raw);
        if (!entries.length) {
            lines.push(`  ✘ ${result.label}: No parsed result`);
            return;
        }
        const comparison = compareOutputs(entries);
        if (comparison) {
            lines.push(`  ${comparison.matched ? "✔" : "✘"} ${result.label} Comparison: ${comparison.matched ? "PASS" : "FAIL"}`);
        }
        for (const entry of entries) {
            const keyValueMatch = entry.text.match(/^([^:]+):\s*([\s\S]*)$/);
            if (keyValueMatch) {
                if (keyValueMatch[1] === "Stdout" && !keyValueMatch[2].trim()) {
                    continue;
                }
                lines.push(`  ${entry.icon} ${result.label} ${keyValueMatch[1]}: ${keyValueMatch[2]}`);
            }
            else {
                lines.push(`  ${entry.icon} ${result.label}: ${entry.text}`);
            }
        }
    });
    return lines.join("\n");
}
function extractMarkedEntries(raw) {
    const entries = [];
    const normalized = stripAnsi(raw).concat("\n  √ ");
    const regSplit = /\s{2}([√×✔✘vx]) ([\s\S]*?)\n(?=\s{2}[√×✔✘vx] )/g;
    let match;
    while ((match = regSplit.exec(normalized)) !== null) {
        entries.push({
            icon: match[1],
            text: match[2].trimEnd(),
        });
    }
    return entries;
}
function compareOutputs(entries) {
    let output = "";
    let expected = "";
    for (const entry of entries) {
        const outputMatch = entry.text.match(/^Output(?: \([^)]+\))?:\s*([\s\S]*)$/);
        if (outputMatch && outputMatch[1].trim() && !output) {
            output = outputMatch[1].trim();
        }
        const expectedMatch = entry.text.match(/^Expected Answer:\s*([\s\S]*)$/);
        if (expectedMatch && expectedMatch[1].trim() && !expected) {
            expected = expectedMatch[1].trim();
        }
    }
    if (!output || !expected) {
        return undefined;
    }
    return {
        matched: output === expected,
        output,
        expected,
    };
}
function stripAnsi(input) {
    return input.replace(/\u001b\[[0-9;]*m/g, "");
}
function cleanErrorMessage(input) {
    const lines = String(input || "")
        .split(/\r?\n/)
        .map((line) => stripAnsi(line).trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith("- Sending code to judge"))
        .filter((line) => !line.startsWith("- Waiting for judge result"))
        .filter((line) => !line.startsWith("(node:"))
        .filter((line) => !line.startsWith("(Use `node --trace-warnings"))
        .filter((line) => !line.includes("DeprecationWarning"));
    const errorLine = lines.find((line) => /\[ERROR\]/i.test(line)) || lines[0] || "Unknown error";
    if (/code=429/i.test(errorLine)) {
        return "LeetCode rate limited this request (HTTP 429). Wait a few seconds and retry.";
    }
    return errorLine;
}
function formatStructuredError(label, message) {
    return `  ✘ ${label}: Test failed\n  ✘ ${label} Error: ${message}`;
}
function isSuccessIcon(icon) {
    return icon === "√" || icon === "✔" || icon === "v";
}
function isRateLimitError(error) {
    return !!(error && error.result && /code=429/i.test(String(error.result)));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function parseTestString(test) {
    if (wsl.useWsl() || !osUtils_1.isWindows()) {
        return `'${test}'`;
    }
    // In windows and not using WSL
    if (osUtils_1.usingCmd()) {
        return `"${test.replace(/"/g, '\\"')}"`;
    }
    else {
        // Assume using PowerShell
        return `'${test.replace(/"/g, '\\"')}'`;
    }
}
//# sourceMappingURL=test.js.map
