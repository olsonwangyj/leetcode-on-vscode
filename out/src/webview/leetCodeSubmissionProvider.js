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
exports.leetCodeSubmissionProvider = void 0;
const vscode_1 = require("vscode");
const uiUtils_1 = require("../utils/uiUtils");
const LeetCodeWebview_1 = require("./LeetCodeWebview");
const markdownEngine_1 = require("./markdownEngine");
class LeetCodeSubmissionProvider extends LeetCodeWebview_1.LeetCodeWebview {
    constructor() {
        super(...arguments);
        this.viewType = "leetcode.submission";
    }
    show(resultString) {
        this.rawResult = resultString;
        this.result = this.parseResult(resultString);
        this.showWebviewInternal();
        this.showKeybindingsHint();
    }
    getWebviewOption() {
        return {
            title: "Submission",
            viewColumn: vscode_1.ViewColumn.Two,
        };
    }
    getWebviewContent() {
        const styles = markdownEngine_1.markdownEngine.getStyles();
        const body = this.hasGroupedCases()
            ? this.renderGroupedCases()
            : this.renderDefaultLayout();
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; script-src vscode-resource:; style-src vscode-resource:;"/>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${styles}
                <style>
                    body {
                        padding: 16px 20px 32px;
                    }
                    .panel {
                        max-width: 920px;
                        margin: 0 auto;
                    }
                    .title {
                        margin: 0 0 12px;
                        font-size: 28px;
                        line-height: 1.25;
                    }
                    .message-list {
                        margin: 0 0 20px;
                        padding-left: 18px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .message-list li {
                        margin: 4px 0;
                    }
                    .result-section {
                        margin-top: 18px;
                        padding-top: 16px;
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                    .section-title {
                        margin: 0 0 12px;
                        font-size: 20px;
                        font-weight: 600;
                    }
                    .section-status {
                        margin: -4px 0 12px;
                        color: var(--vscode-descriptionForeground);
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .field {
                        margin-top: 12px;
                    }
                    .field-label {
                        margin: 0 0 6px;
                        font-size: 13px;
                        font-weight: 600;
                    }
                    .field-value {
                        margin: 0;
                        padding: 10px 12px;
                        background: var(--vscode-textCodeBlock-background);
                        border-radius: 6px;
                        white-space: pre-wrap;
                        word-break: break-word;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 13px;
                        line-height: 1.5;
                    }
                    .muted {
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body class="vscode-body 'scrollBeyondLastLine' 'wordWrap' 'showEditorSelection'" style="tab-size:4">
                <div class="panel">
                    ${body}
                </div>
            </body>
            </html>
        `;
    }
    onDidDisposeWebview() {
        super.onDidDisposeWebview();
    }
    hasGroupedCases() {
        return Object.keys(this.result).some((key) => key !== "messages" && /^((Example|Failed Case) \d+) /.test(key));
    }
    renderGroupedCases() {
        const summary = this.escapeHtml(this.result.messages[0] || "Result");
        const extraMessages = this.result.messages.slice(1).filter((message) => !/^((Example|Failed Case) \d+): /.test(message));
        const sections = this.buildCaseGroups().map((group) => {
            const statusLabel = this.escapeHtml(group.comparison || group.status || "INFO");
            const fields = group.fields.map((field) => `
                <div class="field">
                    <div class="field-label">${this.escapeHtml(field.label)}</div>
                    <pre class="field-value">${this.escapeHtml(field.value)}</pre>
                </div>
            `).join("");
            return `
                <section class="result-section">
                    <h2 class="section-title">${this.escapeHtml(group.label)}</h2>
                    <div class="section-status">${statusLabel}</div>
                    ${fields}
                </section>
            `;
        }).join("");
        const summaryList = extraMessages.length
            ? `<ul class="message-list">${extraMessages.map((message) => `<li>${this.escapeHtml(message)}</li>`).join("")}</ul>`
            : "";
        const fallback = !sections
            ? this.renderRawFallback("No case details were parsed from the result.")
            : "";
        return `
            <h1 class="title">${summary}</h1>
            ${summaryList}
            ${sections}
            ${fallback}
        `;
    }
    renderDefaultLayout() {
        const title = this.escapeHtml(this.result.messages[0] || "Result");
        const messages = this.result.messages.slice(1);
        const sections = Object.keys(this.result)
            .filter((key) => key !== "messages")
            .map((key) => `
                <section class="result-section">
                    <h2 class="section-title">${this.escapeHtml(key)}</h2>
                    <pre class="field-value">${this.escapeHtml(this.result[key].join("\n"))}</pre>
                </section>
            `)
            .join("");
        const messageList = messages.length
            ? `<ul class="message-list">${messages.map((message) => `<li>${this.escapeHtml(message)}</li>`).join("")}</ul>`
            : "";
        const fallback = !messages.length && !sections
            ? this.renderRawFallback("No structured details were parsed from the result.")
            : "";
        return `
            <h1 class="title">${title}</h1>
            ${messageList}
            ${sections}
            ${fallback}
        `;
    }
    buildCaseGroups() {
        const groups = new Map();
        const ensureGroup = (label) => {
            if (!groups.has(label)) {
                groups.set(label, {
                    label,
                    status: "",
                    comparison: "",
                    fields: [],
                });
            }
            return groups.get(label);
        };
        for (const message of this.result.messages.slice(1)) {
            const match = message.match(/^((Example|Failed Case) \d+):\s*(.+)$/);
            if (!match) {
                continue;
            }
            ensureGroup(match[1]).status = match[3];
        }
        for (const key of Object.keys(this.result)) {
            if (key === "messages") {
                continue;
            }
            const match = key.match(/^((Example|Failed Case) \d+) (.+)$/);
            if (!match) {
                continue;
            }
            const group = ensureGroup(match[1]);
            const fieldName = match[3];
            const value = this.result[key].join("\n");
            if (fieldName === "Comparison") {
                group.comparison = value;
            }
            else {
                group.fields.push({
                    label: fieldName,
                    value,
                });
            }
        }
        return Array.from(groups.values());
    }
    getBadgeClass(status) {
        if (/pass|accepted|finished/i.test(status)) {
            return "pass";
        }
        if (/fail|wrong|error/i.test(status)) {
            return "fail";
        }
        return "info";
    }
    escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
    renderRawFallback(title) {
        const raw = this.escapeHtml((this.rawResult || "").trim() || "No raw output captured. Open the LeetCode output channel for more details.");
        return `
            <section class="section-card">
                <div class="section-header">
                    <div class="section-title">${this.escapeHtml(title)}</div>
                </div>
                <div class="field-list">
                    <pre class="field-value">${raw}</pre>
                </div>
            </section>
        `;
    }
    showKeybindingsHint() {
        return __awaiter(this, void 0, void 0, function* () {
            yield uiUtils_1.promptHintMessage("hint.commandShortcut", 'You can customize shortcut key bindings in File > Preferences > Keyboard Shortcuts with query "leetcode".', "Open Keybindings", () => uiUtils_1.openKeybindingsEditor("leetcode solution"));
        });
    }
    parseResult(raw) {
        raw = raw.concat("\n  √ "); // Append a dummy sentinel on a new line so the last entry is preserved
        const regSplit = /  [√×✔✘vx] ([^]+?)\n(?=  [√×✔✘vx] )/g;
        const regKeyVal = /^(.+?):\s*([^]*)$/;
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
                if (value) { // Do not show empty string
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
}
exports.leetCodeSubmissionProvider = new LeetCodeSubmissionProvider();
//# sourceMappingURL=leetCodeSubmissionProvider.js.map
