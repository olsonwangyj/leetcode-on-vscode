"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldAutoCollapseSidebar = exports.getProblemEditorGroups = exports.getPublishedExtensionId = void 0;
const publishedExtensionId = "olsonwangyj.leetcode-on-vscode";
const preferredProblemEditorGroups = Object.freeze([
    { size: 0.4 },
    { size: 0.6 },
]);
function getPublishedExtensionId() {
    return publishedExtensionId;
}
exports.getPublishedExtensionId = getPublishedExtensionId;
function getProblemEditorGroups() {
    return preferredProblemEditorGroups.map((group) => ({ size: group.size }));
}
exports.getProblemEditorGroups = getProblemEditorGroups;
function shouldAutoCollapseSidebar() {
    return true;
}
exports.shouldAutoCollapseSidebar = shouldAutoCollapseSidebar;

