"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.problemTimer = exports.showProblemTimer = void 0;
const path = require("path");
const vscode = require("vscode");
const explorerNodeManager_1 = require("../explorer/explorerNodeManager");
const problemUtils_1 = require("../utils/problemUtils");
const settingUtils = require("../utils/settingUtils");
class ProblemTimerController {
    constructor() {
        this.sessions = new Map();
        this.onDidChangeTimerEmitter = new vscode.EventEmitter();
        this.onDidChangeTimer = this.onDidChangeTimerEmitter.event;
        this.currentCodeLensTimerText = undefined;
        this.timerDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: "0 0 0 2em",
                color: new vscode.ThemeColor("editorCodeLens.foreground"),
                backgroundColor: "rgba(127, 127, 127, 0.18)",
                border: "1px solid rgba(127, 127, 127, 0.25)",
                fontWeight: "600",
                fontStyle: "normal",
            },
        });
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = "leetcode.showProblemTimer";
        this.statusBarItem.name = "LeetCode Problem Timer";
    }
    initialize(context) {
        this.context = context;
        this.interval = setInterval(() => this.updateStatusBar(), 1000);
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => this.updateActiveEditor(editor)), vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration("leetcode.problemTimer.enabled")) {
                this.updateStatusBar();
            }
        }), vscode.window.onDidChangeVisibleTextEditors(() => this.updateEditorTimerDecoration()));
        this.updateActiveEditor(vscode.window.activeTextEditor);
    }
    dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.onDidChangeTimerEmitter.dispose();
        this.timerDecorationType.dispose();
        this.statusBarItem.dispose();
    }
    start(filePath, node, reset = false) {
        if (!settingUtils.isProblemTimerEnabled() || !filePath) {
            return;
        }
        const normalizedPath = this.normalizePath(filePath);
        const existing = this.sessions.get(normalizedPath);
        const session = existing && !reset
            ? existing
            : {
                filePath: normalizedPath,
                startedAt: Date.now(),
                elapsedBeforePause: 0,
                paused: false,
                id: node === null || node === void 0 ? void 0 : node.id,
                name: node === null || node === void 0 ? void 0 : node.name,
            };
        if (existing && !reset) {
            if (session.paused) {
                session.paused = false;
                session.startedAt = Date.now();
            }
            if (node === null || node === void 0 ? void 0 : node.id) {
                session.id = node.id;
            }
            if (node === null || node === void 0 ? void 0 : node.name) {
                session.name = node.name;
            }
        }
        this.sessions.set(normalizedPath, session);
        this.activeProblemFilePath = normalizedPath;
        this.updateStatusBar();
    }
    pause(filePath) {
        const session = this.getSession(filePath);
        if (!session || session.paused) {
            return;
        }
        session.elapsedBeforePause = this.getElapsedMs(session);
        session.paused = true;
        this.updateStatusBar();
    }
    resume(filePath) {
        const session = this.getSession(filePath);
        if (!session || !session.paused) {
            return;
        }
        session.startedAt = Date.now();
        session.paused = false;
        this.updateStatusBar();
    }
    reset(filePath) {
        const session = this.getSession(filePath);
        if (!session) {
            return;
        }
        session.startedAt = Date.now();
        session.elapsedBeforePause = 0;
        session.paused = false;
        this.updateStatusBar();
    }
    stop(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        this.sessions.delete(normalizedPath);
        this.updateStatusBar();
    }
    show(filePathOrUri) {
        return new Promise((resolve) => {
            this.showInternal(filePathOrUri).then(resolve, resolve);
        });
    }
    notifyAccepted(filePath) {
        const session = this.getSession(filePath);
        if (!session || !settingUtils.shouldStopProblemTimerOnAccepted()) {
            return;
        }
        const elapsed = this.formatElapsed(this.getElapsedMs(session));
        this.stop(filePath);
        vscode.window.showInformationMessage(`Accepted in ${elapsed}. Problem timer stopped.`, "Restart Timer").then((choice) => {
            if (choice === "Restart Timer") {
                this.start(filePath, undefined, true);
            }
        });
    }
    getElapsedText(filePath) {
        const session = this.getSession(filePath);
        if (!session) {
            return undefined;
        }
        return this.formatElapsed(this.getElapsedMs(session));
    }
    getSession(filePath) {
        if (!filePath) {
            return undefined;
        }
        return this.sessions.get(this.normalizePath(filePath));
    }
    showInternal(filePathOrUri) {
        return Promise.resolve().then(() => this.resolveFilePath(filePathOrUri)).then((filePath) => {
            if (!filePath) {
                vscode.window.showWarningMessage("Open a LeetCode problem file to use the problem timer.");
                return;
            }
            return this.isProblemFile(filePath).then((isProblemFile) => {
                if (!isProblemFile) {
                    vscode.window.showWarningMessage("The active file does not look like a LeetCode problem file.");
                    return;
                }
                return this.showTimerActions(filePath);
            });
        });
    }
    showTimerActions(filePath) {
        const session = this.getSession(filePath);
        const elapsed = session ? this.formatElapsed(this.getElapsedMs(session)) : "00:00:00";
        const picks = session
            ? [
                {
                    label: session.paused ? "$(play) Resume Timer" : "$(debug-pause) Pause Timer",
                    action: session.paused ? "resume" : "pause",
                },
                {
                    label: "$(debug-restart) Reset Timer",
                    description: elapsed,
                    action: "reset",
                },
                {
                    label: "$(primitive-square) Stop Timer",
                    description: elapsed,
                    action: "stop",
                },
                {
                    label: "$(copy) Copy Elapsed Time",
                    description: elapsed,
                    action: "copy",
                },
            ]
            : [
                {
                    label: "$(play) Start Timer",
                    description: elapsed,
                    action: "start",
                },
            ];
        return vscode.window.showQuickPick(picks, {
            placeHolder: session ? `Problem timer: ${elapsed}` : "Start a timer for this LeetCode problem",
        }).then((pick) => {
            if (!pick) {
                return;
            }
            switch (pick.action) {
                case "start":
                    return this.buildProblemInfo(filePath).then((info) => {
                        this.start(filePath, info, true);
                    });
                case "pause":
                    this.pause(filePath);
                    return;
                case "resume":
                    this.resume(filePath);
                    return;
                case "reset":
                    this.reset(filePath);
                    return;
                case "stop":
                    this.stop(filePath);
                    return;
                case "copy":
                    return vscode.env.clipboard.writeText(elapsed);
            }
        });
    }
    updateActiveEditor(editor) {
        if (!editor || editor.document.uri.scheme !== "file") {
            this.activeProblemFilePath = undefined;
            this.updateStatusBar();
            return;
        }
        const filePath = editor.document.uri.fsPath;
        this.isProblemFile(filePath, editor.document).then((isProblemFile) => {
            this.activeProblemFilePath = isProblemFile ? this.normalizePath(filePath) : undefined;
            if (!isProblemFile || this.getSession(filePath)) {
                this.updateStatusBar();
                return;
            }
            this.buildProblemInfo(filePath).then((info) => {
                if (vscode.window.activeTextEditor === editor) {
                    this.start(filePath, info, true);
                }
            });
        });
    }
    updateStatusBar() {
        if (!settingUtils.isProblemTimerEnabled() || !this.activeProblemFilePath) {
            this.statusBarItem.hide();
            this.updateEditorTimerDecoration();
            this.emitTimerChangeIfNeeded(undefined);
            return;
        }
        const session = this.sessions.get(this.activeProblemFilePath);
        if (!session) {
            this.statusBarItem.text = "$(watch) Start Timer";
            this.statusBarItem.tooltip = "Start a LeetCode problem timer";
            this.statusBarItem.show();
            this.updateEditorTimerDecoration();
            this.emitTimerChangeIfNeeded("Start Timer");
            return;
        }
        const elapsed = this.formatElapsed(this.getElapsedMs(session));
        this.statusBarItem.text = `${session.paused ? "$(debug-pause)" : "$(watch)"} ${elapsed}`;
        this.statusBarItem.tooltip = `${session.paused ? "Paused" : "Solving"}: ${session.name || path.basename(session.filePath)} (${elapsed})`;
        this.statusBarItem.show();
        this.updateEditorTimerDecoration(elapsed, session.paused);
        this.emitTimerChangeIfNeeded(elapsed);
    }
    updateEditorTimerDecoration(elapsed, paused = false) {
        const activeEditor = vscode.window.activeTextEditor;
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor !== activeEditor) {
                editor.setDecorations(this.timerDecorationType, []);
            }
        }
        if (!settingUtils.isProblemTimerEnabled() || !activeEditor || activeEditor.document.uri.scheme !== "file") {
            if (activeEditor) {
                activeEditor.setDecorations(this.timerDecorationType, []);
            }
            return;
        }
        const filePath = this.normalizePath(activeEditor.document.uri.fsPath);
        if (this.activeProblemFilePath !== filePath) {
            activeEditor.setDecorations(this.timerDecorationType, []);
            return;
        }
        const session = this.sessions.get(filePath);
        const text = session ? `${paused ? "Paused" : "Timer"} ${elapsed || this.formatElapsed(this.getElapsedMs(session))}` : "Start Timer";
        activeEditor.setDecorations(this.timerDecorationType, [
            {
                range: this.getTimerDecorationRange(activeEditor.document),
                renderOptions: {
                    after: {
                        contentText: ` ${text} `,
                    },
                },
            },
        ]);
    }
    getTimerDecorationRange(document) {
        let line = 0;
        for (let i = 0; i < document.lineCount; i++) {
            const text = document.lineAt(i).text;
            if (text.indexOf("@lc code=start") >= 0) {
                line = i;
                break;
            }
        }
        const end = document.lineAt(line).range.end;
        return new vscode.Range(end, end);
    }
    resolveFilePath(filePathOrUri) {
        if (filePathOrUri instanceof vscode.Uri) {
            return filePathOrUri.fsPath;
        }
        if (typeof filePathOrUri === "string") {
            return filePathOrUri;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== "file") {
            return undefined;
        }
        return editor.document.uri.fsPath;
    }
    isProblemFile(filePath, document) {
        return Promise.resolve().then(() => {
            const basename = path.basename(filePath);
            if (basename.endsWith(".debug.txt")) {
                return false;
            }
            const text = document ? document.getText() : undefined;
            if (text && /@lc\s+app=.*\sid=.+?\slang=/.test(text)) {
                return true;
            }
            return /^\d+\..+\.[^.]+$/.test(basename);
        });
    }
    buildProblemInfo(filePath) {
        return problemUtils_1.getNodeIdFromFile(filePath).then((id) => {
            const node = id ? explorerNodeManager_1.explorerNodeManager.getNodeById(id) : undefined;
            return {
                id,
                name: (node === null || node === void 0 ? void 0 : node.name) || path.basename(filePath),
            };
        }, () => ({
            id: undefined,
            name: path.basename(filePath),
        }));
    }
    getElapsedMs(session) {
        if (session.paused) {
            return session.elapsedBeforePause;
        }
        return session.elapsedBeforePause + Date.now() - session.startedAt;
    }
    formatElapsed(elapsedMs) {
        const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 3600);
        return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`;
    }
    emitTimerChangeIfNeeded(nextText) {
        if (this.currentCodeLensTimerText === nextText) {
            return;
        }
        this.currentCodeLensTimerText = nextText;
        this.onDidChangeTimerEmitter.fire();
    }
    pad(value) {
        return value < 10 ? `0${value}` : `${value}`;
    }
    normalizePath(filePath) {
        return path.resolve(filePath);
    }
}
exports.problemTimer = new ProblemTimerController();
function showProblemTimer(uri) {
    return exports.problemTimer.show(uri);
}
exports.showProblemTimer = showProblemTimer;
//# sourceMappingURL=timer.js.map
