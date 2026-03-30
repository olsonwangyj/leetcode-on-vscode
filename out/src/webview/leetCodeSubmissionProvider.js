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
                        padding: 20px 24px 40px;
                    }
                    .panel {
                        max-width: 980px;
                        margin: 0 auto;
                    }
                    .hero {
                        padding: 18px 20px;
                        border-radius: 16px;
                        border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
                        background:
                            radial-gradient(circle at top right, rgba(86, 156, 214, 0.18), transparent 38%),
                            linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent);
                    }
                    .hero h1 {
                        margin: 0;
                        font-size: 28px;
                        line-height: 1.2;
                    }
                    .hero ul {
                        margin: 12px 0 0;
                        padding-left: 18px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .case-list,
                    .section-list {
                        display: grid;
                        gap: 16px;
                        margin-top: 18px;
                    }
                    .case-card,
                    .section-card {
                        border-radius: 16px;
                        border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
                        overflow: hidden;
                        background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
                    }
                    .case-header,
                    .section-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 12px;
                        padding: 14px 16px;
                        border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
                        background: rgba(255, 255, 255, 0.03);
                    }
                    .case-title,
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                    }
                    .badge {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-width: 82px;
                        padding: 4px 10px;
                        border-radius: 999px;
                        font-size: 12px;
                        font-weight: 700;
                        letter-spacing: 0.05em;
                        text-transform: uppercase;
                    }
                    .badge.pass {
                        background: rgba(76, 175, 80, 0.18);
                        color: #a8e6a3;
                    }
                    .badge.fail {
                        background: rgba(244, 67, 54, 0.18);
                        color: #ffb4ad;
                    }
                    .badge.info {
                        background: rgba(86, 156, 214, 0.18);
                        color: #9ecfff;
                    }
                    .field-list {
                        display: grid;
                        gap: 12px;
                        padding: 14px 16px 16px;
                    }
                    .field-label {
                        margin-bottom: 6px;
                        font-size: 12px;
                        font-weight: 700;
                        letter-spacing: 0.05em;
                        text-transform: uppercase;
                        color: var(--vscode-descriptionForeground);
                    }
                    .field-value {
                        margin: 0;
                        padding: 10px 12px;
                        border-radius: 10px;
                        border: 1px solid rgba(255, 255, 255, 0.06);
                        background: var(--vscode-textCodeBlock-background);
                        white-space: pre-wrap;
                        word-break: break-word;
                        font-family: var(--vscode-editor-font-family);
                        font-size: 13px;
                        line-height: 1.5;
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
        const cards = this.buildCaseGroups().map((group) => {
            const statusLabel = group.comparison || group.status || "INFO";
            const statusClass = this.getBadgeClass(statusLabel);
            const fields = group.fields.map((field) => `
                <div class="field">
                    <div class="field-label">${this.escapeHtml(field.label)}</div>
                    <pre class="field-value">${this.escapeHtml(field.value)}</pre>
                </div>
            `).join("");
            return `
                <section class="case-card">
                    <div class="case-header">
                        <div class="case-title">${this.escapeHtml(group.label)}</div>
                        <div class="badge ${statusClass}">${this.escapeHtml(statusLabel)}</div>
                    </div>
                    <div class="field-list">
                        ${fields}
                    </div>
                </section>
            `;
        }).join("");
        const summaryList = extraMessages.length
            ? `<ul>${extraMessages.map((message) => `<li>${this.escapeHtml(message)}</li>`).join("")}</ul>`
            : "";
        const fallback = !cards
            ? this.renderRawFallback("No case details were parsed from the result.")
            : "";
        return `
            <section class="hero">
                <h1>${summary}</h1>
                ${summaryList}
            </section>
            <div class="case-list">
                ${cards}
                ${fallback}
            </div>
        `;
    }
    renderDefaultLayout() {
        const title = this.escapeHtml(this.result.messages[0] || "Result");
        const messages = this.result.messages.slice(1);
        const sections = Object.keys(this.result)
            .filter((key) => key !== "messages")
            .map((key) => `
                <section class="section-card">
                    <div class="section-header">
                        <div class="section-title">${this.escapeHtml(key)}</div>
                    </div>
                    <div class="field-list">
                        <pre class="field-value">${this.escapeHtml(this.result[key].join("\n"))}</pre>
                    </div>
                </section>
            `)
            .join("");
        const messageList = messages.length
            ? `<ul>${messages.map((message) => `<li>${this.escapeHtml(message)}</li>`).join("")}</ul>`
            : "";
        const fallback = !messages.length && !sections
            ? this.renderRawFallback("No structured details were parsed from the result.")
            : "";
        return `
            <section class="hero">
                <h1>${title}</h1>
                ${messageList}
            </section>
            <div class="section-list">
                ${sections}
                ${fallback}
            </div>
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
