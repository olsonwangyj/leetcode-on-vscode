"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveProblemTestcase = exports.loadProblemTestcases = void 0;
const fse = require("fs-extra");
const path = require("path");
const settingUtils = require("./settingUtils");
const STORE_FILE_NAME = ".leetcode-extra-testcases.json";
const MAX_TESTCASES_PER_PROBLEM = 10;
const TRUNCATED_TESTCASE_PATTERN = /\.\.\.\s+\d+\s+more character(?:s)?/i;
function loadProblemTestcases(filePath, problemId) {
    return loadStore(filePath).then((store) => {
        const values = store[problemId];
        if (!Array.isArray(values)) {
            return [];
        }
        return values
            .filter((value) => isReusableTestcase(value))
            .map((value) => normalizeTestcase(value));
    });
}
exports.loadProblemTestcases = loadProblemTestcases;
function saveProblemTestcase(filePath, problemId, testcase) {
    return loadStore(filePath).then((store) => {
        const normalized = normalizeTestcase(testcase);
        if (!problemId || !isReusableTestcase(normalized)) {
            return;
        }
        const existing = Array.isArray(store[problemId]) ? store[problemId].filter((value) => isReusableTestcase(value)) : [];
        store[problemId] = [normalized, ...existing.filter((value) => normalizeTestcase(value) !== normalized)].slice(0, MAX_TESTCASES_PER_PROBLEM);
        return fse.outputJson(getStorePath(filePath), store, { spaces: 2 });
    });
}
exports.saveProblemTestcase = saveProblemTestcase;
function loadStore(filePath) {
    return fse.pathExists(getStorePath(filePath)).then((exists) => {
        if (!exists) {
            return {};
        }
        return fse.readJson(getStorePath(filePath)).catch(() => ({}));
    });
}
function getStorePath(filePath) {
    const workspaceFolder = (settingUtils.getWorkspaceFolder() || "").trim();
    const root = workspaceFolder || path.dirname(filePath);
    return path.join(root, STORE_FILE_NAME);
}
function normalizeTestcase(testcase) {
    return String(testcase || "").replace(/\r\n/g, "\n").trim();
}
function isReusableTestcase(testcase) {
    const normalized = normalizeTestcase(testcase);
    return Boolean(normalized) && !TRUNCATED_TESTCASE_PATTERN.test(normalized);
}
