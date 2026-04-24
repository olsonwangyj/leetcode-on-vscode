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
exports.openDebugCases = exports.debugSolution = void 0;
const childProcess = require("child_process");
const crypto = require("crypto");
const fse = require("fs-extra");
const he = require("he");
const net = require("net");
const os = require("os");
const path = require("path");
const util = require("util");
const vscode = require("vscode");
const leetCodeExecutor_1 = require("../leetCodeExecutor");
const leetCodeManager_1 = require("../leetCodeManager");
const shared_1 = require("../shared");
const customTestcaseStore_1 = require("../utils/customTestcaseStore");
const problemUtils_1 = require("../utils/problemUtils");
const settingUtils = require("../utils/settingUtils");
const uiUtils_1 = require("../utils/uiUtils");
const workspaceUtils_1 = require("../utils/workspaceUtils");
const leetCodeSubmissionProvider_1 = require("../webview/leetCodeSubmissionProvider");
const DEBUG_CASE_FILE_SUFFIX = ".debug.txt";
const DEBUG_MAIN_CLASS = "LeetCodeDebugMain";
const JAVA_DEBUG_EXTENSION_ID = "vscjava.vscode-java-debug";
const JAVA_EXTENSION_PACK_ID = "vscjava.vscode-java-pack";
const JAVA_DEBUGGING_DOC_URL = "https://code.visualstudio.com/docs/java/java-debugging";
const JAVA_SETUP_DOC_URL = "https://code.visualstudio.com/docs/java/java-project#_configure-jdk";
const JDK_DOWNLOAD_URL = "https://adoptium.net/";
const DEBUG_RUNTIME_ROOT = path.join(os.homedir(), ".leetcode", ".debug-runtime");
const JAVA_DEBUG_ATTACH_HOST = "127.0.0.1";
const JAVA_DEBUG_ATTACH_POLL_MS = 150;
const JAVA_DEBUG_ATTACH_TIMEOUT_MS = 15000;
const INTER_TEST_DELAY_MS = 2000;
const RATE_LIMIT_RETRY_DELAYS_MS = [5000, 10000, 15000];
const execFile = util.promisify(childProcess.execFile);
const activeJavaDebugProcesses = new Map();
let javaDebugOutputChannel;
let javaDebugSessionHooksRegistered = false;
function debugSolution(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const filePath = yield getActiveFilePath(uri);
        if (!filePath) {
            return;
        }
        if (isJavaFile(filePath)) {
            try {
                yield debugJavaSolution(filePath, uri);
                return;
            }
            catch (error) {
                if (error instanceof UserCancelledError) {
                    return;
                }
                yield handleDebugFailure(error, "Failed to start VS Code debug for this problem.");
                return;
            }
        }
        try {
            yield debugSolutionWithSavedCases(filePath, uri);
        }
        catch (error) {
            if (error instanceof UserCancelledError) {
                return;
            }
            yield handleDebugFailure(error, "Failed to debug the solution.");
        }
    });
}
exports.debugSolution = debugSolution;
function openDebugCases(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const filePath = yield getActiveFilePath(uri);
        if (!filePath) {
            return;
        }
        const debugCaseFilePath = getDebugCaseFilePath(filePath);
        yield ensureDebugCaseFile(filePath, debugCaseFilePath);
        yield vscode.window.showTextDocument(vscode.Uri.file(debugCaseFilePath), {
            preview: false,
            viewColumn: vscode.ViewColumn.Beside,
        });
    });
}
exports.openDebugCases = openDebugCases;
function debugJavaSolution(filePath, uri) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureJavaDebugReady();
        const entryMethod = yield detectJavaEntryMethod(filePath);
        const selectedCase = yield pickJavaDebugCase(filePath, entryMethod);
        if (!selectedCase) {
            throw new UserCancelledError();
        }
        if (selectedCase.kind === "open-file") {
            yield openDebugCases(uri);
            throw new UserCancelledError();
        }
        const debugRuntime = yield prepareJavaDebugWorkspace(filePath, selectedCase, entryMethod.name);
        const sessionName = `LeetCode Debug: ${path.basename(filePath)} [${Date.now().toString(36)}]`;
        const launchedProcess = yield launchIsolatedJavaDebugProcess(filePath, debugRuntime, sessionName);
        try {
            const started = yield vscode.debug.startDebugging(undefined, {
                type: "java",
                name: sessionName,
                request: "attach",
                hostName: JAVA_DEBUG_ATTACH_HOST,
                port: launchedProcess.port,
                sourcePaths: [path.dirname(filePath), debugRuntime.sourceDir],
            });
            if (!started) {
                throw new Error("VS Code did not start the Java debug session.");
            }
        }
        catch (error) {
            cleanupJavaDebugProcess(sessionName, "Debug session failed to attach.");
            throw error;
        }
    });
}
function ensureJavaDebugReady() {
    return __awaiter(this, void 0, void 0, function* () {
        const javaDebugExtension = vscode.extensions.getExtension(JAVA_DEBUG_EXTENSION_ID);
        if (!javaDebugExtension) {
            const installPack = "Install Java Extension Pack";
            const installDebugger = "Install Java Debugger";
            const openGuide = "Open Setup Guide";
            const choice = yield vscode.window.showErrorMessage("Debug for Java problems needs the Java debugger tools from the Java Extension Pack. Install them once, then click Debug again.", installPack, installDebugger, openGuide);
            if (choice === installPack) {
                yield beginExtensionInstall(JAVA_EXTENSION_PACK_ID, "Java Extension Pack");
            }
            else if (choice === installDebugger) {
                yield beginExtensionInstall(JAVA_DEBUG_EXTENSION_ID, "Java Debugger");
            }
            else if (choice === openGuide) {
                yield uiUtils_1.openUrl(JAVA_DEBUGGING_DOC_URL);
            }
            throw new UserCancelledError();
        }
        if (!javaDebugExtension.isActive) {
            yield javaDebugExtension.activate();
        }
        yield resolveJavacPath();
    });
}
function beginExtensionInstall(extensionId, label) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield vscode.commands.executeCommand("workbench.extensions.installExtension", extensionId);
            vscode.window.showInformationMessage(`${label} is installing. After it finishes, click Debug in VS Code again.`);
        }
        catch (error) {
            const message = normalizeTestcase((error && error.message) || String(error || "")).replace(/\s+/g, " ");
            throw new Error(message ? `Failed to start installing ${label}. ${message}` : `Failed to start installing ${label}.`);
        }
    });
}
function pickJavaDebugCase(filePath, entryMethod) {
    return __awaiter(this, void 0, void 0, function* () {
        const officialExamples = yield loadOfficialExamples(filePath);
        const failedCases = yield loadFailedCases(filePath);
        const savedDebugCases = yield loadExistingDebugCases(filePath);
        const seen = new Set();
        const quickPickItems = [];
        const pushCase = (kind, label, input, expectedOutput, description) => {
            const normalizedInput = normalizeTestcase(input);
            if (!normalizedInput || seen.has(`${kind}:${normalizedInput}`) || seen.has(`case:${normalizedInput}`)) {
                return;
            }
            seen.add(`${kind}:${normalizedInput}`);
            seen.add(`case:${normalizedInput}`);
            quickPickItems.push({
                kind,
                label,
                input: normalizedInput,
                expectedOutput: normalizeTestcase(expectedOutput || ""),
                description,
                detail: previewCase(normalizedInput, expectedOutput),
            });
        };
        const defaultCustomCase = savedDebugCases[0] || officialExamples[0] || (failedCases[0] ? { input: failedCases[0], expectedOutput: "" } : undefined);
        quickPickItems.push({
            kind: "custom",
            label: "Custom Input...",
            description: entryMethod.parameters.length
                ? `Fill ${entryMethod.parameters.length} field(s) in popup`
                : "Enter the raw testcase input in popup",
            detail: buildCustomInputDetail(entryMethod, defaultCustomCase),
        });
        officialExamples.forEach((example, index) => pushCase("example", `Example ${index + 1}`, example.input, example.output, "Official LeetCode example"));
        failedCases.forEach((testcase, index) => pushCase("failed", `Failed Case ${index + 1}`, testcase, "", "Saved from a failed submission"));
        savedDebugCases.forEach((debugCase, index) => pushCase("saved", `Saved Debug Case ${index + 1}`, debugCase.input, debugCase.expectedOutput, "Saved in .debug.txt"));
        quickPickItems.push({
            kind: "open-file",
            label: "Open Debug Cases File",
            description: "Create or edit custom debug cases",
            detail: "Use .debug.txt when you want a custom testcase that is not in the official examples or failed submissions.",
        });
        const selectedCase = yield vscode.window.showQuickPick(quickPickItems, {
            placeHolder: "Select the testcase to debug with VS Code breakpoints",
            matchOnDescription: true,
            matchOnDetail: true,
        });
        if (!selectedCase) {
            return undefined;
        }
        if (selectedCase.kind === "custom") {
            return yield promptForJavaCustomDebugCase(entryMethod, defaultCustomCase);
        }
        return selectedCase;
    });
}
function buildCustomInputDetail(entryMethod, defaultCustomCase) {
    if (entryMethod.parameters.length) {
        const signature = entryMethod.parameters.map((parameter) => `${parameter.name}: ${parameter.type}`).join(", ");
        const templateInput = defaultCustomCase && defaultCustomCase.input ? `  Template: ${previewCase(defaultCustomCase.input, "")}` : "";
        return `Method inputs: ${signature}.${templateInput}`;
    }
    if (defaultCustomCase && defaultCustomCase.input) {
        return `Template: ${previewCase(defaultCustomCase.input, "")}`;
    }
    return "Type the same values you would normally put into LeetCode's Input box.";
}
function promptForJavaCustomDebugCase(entryMethod, defaultCustomCase) {
    return __awaiter(this, void 0, void 0, function* () {
        const defaultValues = splitDebugInput((defaultCustomCase === null || defaultCustomCase === void 0 ? void 0 : defaultCustomCase.input) || "");
        if (!entryMethod.parameters.length) {
            const rawInput = yield vscode.window.showInputBox({
                prompt: entryMethod.name
                    ? `Enter the testcase for ${entryMethod.name}. Use one argument per line when there are multiple inputs.`
                    : "Enter the testcase input.",
                value: (defaultCustomCase === null || defaultCustomCase === void 0 ? void 0 : defaultCustomCase.input) || "",
                placeHolder: "Example: [1,2,3]\\n2",
                ignoreFocusOut: true,
                validateInput: (value) => value && value.trim() ? undefined : "Input must not be empty.",
            });
            if (rawInput === undefined) {
                throw new UserCancelledError();
            }
            return {
                kind: "custom",
                label: "Custom Input",
                input: normalizeTestcase(rawInput),
                expectedOutput: "",
                description: "Typed in popup",
                detail: previewCase(rawInput, ""),
            };
        }
        const collectedValues = [];
        for (let i = 0; i < entryMethod.parameters.length; i++) {
            const parameter = entryMethod.parameters[i];
            const value = yield vscode.window.showInputBox({
                prompt: `Input ${i + 1}/${entryMethod.parameters.length}: ${parameter.name} (${parameter.type})`,
                value: defaultValues[i] || "",
                placeHolder: buildJavaParameterPlaceholder(parameter.type),
                ignoreFocusOut: true,
                validateInput: (input) => input && input.trim() ? undefined : `${parameter.name} is required.`,
            });
            if (value === undefined) {
                throw new UserCancelledError();
            }
            collectedValues.push(normalizeTestcase(value));
        }
        return {
            kind: "custom",
            label: "Custom Input",
            input: collectedValues.join("\n"),
            expectedOutput: "",
            description: `Typed for ${entryMethod.name || "Solution"}`,
            detail: previewCase(collectedValues.join("\n"), ""),
        };
    });
}
function buildJavaParameterPlaceholder(type) {
    const normalizedType = String(type || "").trim().toLowerCase();
    if (!normalizedType) {
        return "Example: [1,2,3]";
    }
    if (normalizedType.includes("string")) {
        return normalizedType.includes("[") || normalizedType.startsWith("list<") ? 'Example: ["ab","cd"]' : 'Example: "abc"';
    }
    if (normalizedType.includes("char")) {
        return normalizedType.includes("[") || normalizedType.startsWith("list<") ? "Example: ['a','b']" : "Example: 'a'";
    }
    if (normalizedType.includes("boolean")) {
        return normalizedType.includes("[") || normalizedType.startsWith("list<") ? "Example: [true,false]" : "Example: true";
    }
    if (normalizedType.includes("[") || normalizedType.startsWith("list<")) {
        return normalizedType.includes("[]") && normalizedType.indexOf("[][]") >= 0 ? "Example: [[1,2],[3,4]]" : "Example: [1,2,3]";
    }
    return "Example: 2";
}
function splitDebugInput(input) {
    const values = [];
    const normalizedInput = String(input || "").replace(/\r\n/g, "\n");
    let current = "";
    let quote = "";
    let escaped = false;
    let depth = 0;
    for (const ch of normalizedInput) {
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
            depth++;
            current += ch;
            continue;
        }
        if (ch === "]" || ch === "}" || ch === ")") {
            depth--;
            current += ch;
            continue;
        }
        if ((ch === "\n" || ch === "\r") && depth === 0) {
            if (current.trim()) {
                values.push(current.trim());
            }
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim()) {
        values.push(current.trim());
    }
    return values;
}
function previewCase(input, expectedOutput) {
    const compactInput = normalizeTestcase(input).replace(/\n/g, " | ");
    const compactExpected = normalizeTestcase(expectedOutput || "").replace(/\n/g, " | ");
    if (compactExpected) {
        return `Input: ${truncate(compactInput, 120)}   Expected: ${truncate(compactExpected, 80)}`;
    }
    return `Input: ${truncate(compactInput, 140)}`;
}
function truncate(value, maxLength) {
    if (!value || value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 3)}...`;
}
function prepareJavaDebugWorkspace(filePath, selectedCase, entryMethodName) {
    return __awaiter(this, void 0, void 0, function* () {
        const runtimeKey = `${path.basename(filePath, path.extname(filePath))}-${crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 8)}`;
        const runtimeDir = path.join(DEBUG_RUNTIME_ROOT, runtimeKey);
        const sourceDir = path.join(runtimeDir, "src");
        const classesDir = path.join(runtimeDir, "classes");
        const helperPath = path.join(sourceDir, `${DEBUG_MAIN_CLASS}.java`);
        yield fse.ensureDir(sourceDir);
        yield fse.emptyDir(classesDir);
        yield fse.outputFile(helperPath, buildJavaDebugMain(path.basename(filePath), selectedCase, entryMethodName), "utf8");
        const javacPath = yield resolveJavacPath();
        try {
            yield execFile(javacPath, ["-encoding", "UTF-8", "-g", "-d", classesDir, filePath, helperPath], {
                cwd: path.dirname(filePath),
            });
        }
        catch (error) {
            const stderr = normalizeTestcase((error === null || error === void 0 ? void 0 : error.stderr) || "");
            const stdout = normalizeTestcase((error === null || error === void 0 ? void 0 : error.stdout) || "");
            throw new Error(stderr || stdout || "Failed to compile the current solution for debugging.");
        }
        return { sourceDir, classesDir, helperPath };
    });
}
function launchIsolatedJavaDebugProcess(filePath, debugRuntime, sessionName) {
    return __awaiter(this, void 0, void 0, function* () {
        ensureJavaDebugSessionHooks();
        const javacPath = yield resolveJavacPath();
        const javaPath = yield resolveJavaPath(javacPath);
        const port = yield findAvailablePort();
        const outputChannel = getJavaDebugOutputChannel();
        const javaArgs = [
            `-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=${JAVA_DEBUG_ATTACH_HOST}:${port}`,
            "-XX:+ShowCodeDetailsInExceptionMessages",
            "-Dfile.encoding=UTF-8",
            "-cp",
            debugRuntime.classesDir,
            DEBUG_MAIN_CLASS,
        ];
        outputChannel.appendLine("");
        outputChannel.appendLine(`[LeetCode Debug] Starting ${sessionName}`);
        outputChannel.appendLine(`[LeetCode Debug] Source: ${filePath}`);
        outputChannel.appendLine(`[LeetCode Debug] Classpath: ${debugRuntime.classesDir}`);
        outputChannel.appendLine(`[LeetCode Debug] Command: ${javaPath} ${javaArgs.join(" ")}`);
        const child = childProcess.spawn(javaPath, javaArgs, {
            cwd: path.dirname(filePath),
            stdio: ["ignore", "pipe", "pipe"],
        });
        const runtime = {
            child,
            outputChannel,
            sessionName,
        };
        activeJavaDebugProcesses.set(sessionName, runtime);
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
            const text = chunk.toString();
            stdout += text;
            outputChannel.append(text);
        });
        child.stderr.on("data", (chunk) => {
            const text = chunk.toString();
            stderr += text;
            outputChannel.append(text);
        });
        child.on("exit", (code, signal) => {
            activeJavaDebugProcesses.delete(sessionName);
            const status = signal ? `signal ${signal}` : `exit code ${code === null ? "unknown" : code}`;
            outputChannel.appendLine(`\n[LeetCode Debug] Java process ended with ${status}.`);
        });
        try {
            yield waitForJavaDebugServer(child, port);
        }
        catch (error) {
            cleanupJavaDebugProcess(sessionName, "Java debug launch did not become attachable.");
            const details = summarizeJavaLaunchFailure(stdout, stderr);
            throw new Error(details ? `${error.message}\n${details}` : error.message);
        }
        return { port };
    });
}
function getJavaDebugOutputChannel() {
    if (!javaDebugOutputChannel) {
        javaDebugOutputChannel = vscode.window.createOutputChannel("LeetCode Debug");
    }
    return javaDebugOutputChannel;
}
function ensureJavaDebugSessionHooks() {
    if (javaDebugSessionHooksRegistered) {
        return;
    }
    javaDebugSessionHooksRegistered = true;
    vscode.debug.onDidTerminateDebugSession((session) => {
        cleanupJavaDebugProcess(session.name, "Debug session ended.");
    });
}
function cleanupJavaDebugProcess(sessionName, reason) {
    const runtime = activeJavaDebugProcesses.get(sessionName);
    if (!runtime) {
        return;
    }
    activeJavaDebugProcesses.delete(sessionName);
    if (!runtime.child.killed) {
        runtime.outputChannel.appendLine(`[LeetCode Debug] ${reason}`);
        runtime.child.kill();
    }
}
function waitForJavaDebugServer(child, port) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            fail(new Error(`Timed out waiting for the Java debug server on port ${port}.`));
        }, JAVA_DEBUG_ATTACH_TIMEOUT_MS);
        const onError = (error) => {
            fail(error instanceof Error ? error : new Error(String(error || "Unknown Java debug launch failure.")));
        };
        const onExit = (code, signal) => {
            const status = signal ? `signal ${signal}` : `exit code ${code === null ? "unknown" : code}`;
            fail(new Error(`The isolated Java debug launcher ended before VS Code could attach (${status}).`));
        };
        const tryConnect = () => {
            if (settled) {
                return;
            }
            const socket = net.createConnection({ host: JAVA_DEBUG_ATTACH_HOST, port }, () => {
                socket.end();
                succeed();
            });
            socket.on("error", () => {
                socket.destroy();
                if (!settled) {
                    setTimeout(tryConnect, JAVA_DEBUG_ATTACH_POLL_MS);
                }
            });
        };
        const succeed = () => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            child.removeListener("error", onError);
            child.removeListener("exit", onExit);
            resolve();
        };
        const fail = (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            child.removeListener("error", onError);
            child.removeListener("exit", onExit);
            reject(error);
        };
        child.once("error", onError);
        child.once("exit", onExit);
        tryConnect();
    });
}
function summarizeJavaLaunchFailure(stdout, stderr) {
    const combined = [normalizeTestcase(stderr), normalizeTestcase(stdout)].filter(Boolean);
    return combined.join("\n");
}
function findAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once("error", reject);
        server.listen(0, JAVA_DEBUG_ATTACH_HOST, () => {
            const address = server.address();
            const port = address && typeof address === "object" ? address.port : 0;
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (!port) {
                    reject(new Error("Could not reserve a local port for Java debugging."));
                    return;
                }
                resolve(port);
            });
        });
    });
}
function resolveJavacPath() {
    return __awaiter(this, void 0, void 0, function* () {
        const locator = process.platform === "win32" ? "where" : "which";
        try {
            const result = yield execFile(locator, ["javac"]);
            const javacPath = normalizeTestcase(result.stdout).split(/\r?\n/)[0];
            if (!javacPath) {
                throw new Error("javac not found");
            }
            return javacPath;
        }
        catch (_a) {
            const openDownloads = "Open JDK Downloads";
            const openGuide = "Open Java Setup Guide";
            const choice = yield vscode.window.showErrorMessage("Debug for Java problems needs a JDK with javac available. Install a JDK, restart VS Code if needed, then click Debug again.", openDownloads, openGuide);
            if (choice === openDownloads) {
                yield uiUtils_1.openUrl(JDK_DOWNLOAD_URL);
            }
            else if (choice === openGuide) {
                yield uiUtils_1.openUrl(JAVA_SETUP_DOC_URL);
            }
            throw new UserCancelledError();
        }
    });
}
function resolveJavaPath(javacPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const javaBinaryName = process.platform === "win32" ? "java.exe" : "java";
        const siblingJavaPath = path.join(path.dirname(javacPath), javaBinaryName);
        if (yield fse.pathExists(siblingJavaPath)) {
            return siblingJavaPath;
        }
        const locator = process.platform === "win32" ? "where" : "which";
        const result = yield execFile(locator, ["java"]);
        const javaPath = normalizeTestcase(result.stdout).split(/\r?\n/)[0];
        if (!javaPath) {
            throw new Error("java not found");
        }
        return javaPath;
    });
}
function detectJavaEntryMethod(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield fse.readFile(filePath, "utf8");
        const source = extractCodeRegion(raw);
        const lines = source.split(/\r?\n/);
        let insideSolutionClass = false;
        let braceDepth = 0;
        let pendingSignature = "";
        const candidates = [];
        for (const line of lines) {
            const sanitizedLine = stripJavaLineComments(line);
            if (!insideSolutionClass) {
                if (/\bclass\s+Solution\b/.test(sanitizedLine)) {
                    insideSolutionClass = true;
                    braceDepth += countBraces(sanitizedLine);
                }
                continue;
            }
            if (braceDepth === 1) {
                const trimmedLine = sanitizedLine.trim();
                if (trimmedLine) {
                    pendingSignature = pendingSignature ? `${pendingSignature} ${trimmedLine}` : trimmedLine;
                    const candidate = tryParseJavaMethodSignature(pendingSignature);
                    if (candidate) {
                        candidates.push(candidate);
                        pendingSignature = "";
                    }
                    else if (shouldResetJavaSignatureBuffer(pendingSignature, trimmedLine)) {
                        pendingSignature = "";
                    }
                }
                else if (!pendingSignature) {
                    pendingSignature = "";
                }
            }
            else {
                pendingSignature = "";
            }
            braceDepth += countBraces(sanitizedLine);
            if (braceDepth <= 0) {
                break;
            }
        }
        const entryMethod = pickBestJavaEntryMethod(candidates);
        if (entryMethod) {
            return {
                name: entryMethod.name,
                parameters: entryMethod.parameters,
            };
        }
        return {
            name: "",
            parameters: [],
        };
    });
}
function stripJavaLineComments(line) {
    let result = "";
    let quote = "";
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = i + 1 < line.length ? line[i + 1] : "";
        if (quote) {
            result += ch;
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
            result += ch;
            continue;
        }
        if (ch === "/" && next === "/") {
            break;
        }
        result += ch;
    }
    return result;
}
function tryParseJavaMethodSignature(signature) {
    const sanitizedSignature = String(signature || "")
        .replace(/@\w+(?:\([^)]*\))?\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const match = sanitizedSignature.match(/^(?:(public|protected|private)\s+)?(?:(?:static|final|synchronized|abstract|default|native|strictfp)\s+)*(?:<[^>]+>\s*)?[\w\[\]<>, ?]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*(?:throws [^{]+)?\{$/);
    if (!match || ["if", "for", "while", "switch", "catch"].includes(match[2])) {
        return undefined;
    }
    return {
        name: match[2],
        parameters: parseJavaMethodParameters(match[3]),
        visibility: match[1] || "",
        isStatic: /\bstatic\b/.test(sanitizedSignature),
    };
}
function shouldResetJavaSignatureBuffer(signature, currentLine) {
    if (!signature) {
        return false;
    }
    if (/[;=]\s*$/.test(currentLine) || /\b(class|interface|enum|record)\b/.test(currentLine)) {
        return true;
    }
    return currentLine.includes("{") && !/\)\s*(?:throws [^{]+)?\{$/.test(signature);
}
function pickBestJavaEntryMethod(candidates) {
    if (!candidates.length) {
        return undefined;
    }
    let bestCandidate = candidates[0];
    let bestScore = scoreJavaEntryMethod(candidates[0]);
    for (let i = 1; i < candidates.length; i++) {
        const score = scoreJavaEntryMethod(candidates[i]);
        if (score > bestScore) {
            bestCandidate = candidates[i];
            bestScore = score;
        }
    }
    return bestCandidate;
}
function scoreJavaEntryMethod(candidate) {
    let score = 0;
    if (candidate.visibility === "public") {
        score += 100;
    }
    else if (!candidate.visibility) {
        score += 40;
    }
    else if (candidate.visibility === "protected") {
        score += 10;
    }
    if (!candidate.isStatic) {
        score += 5;
    }
    score += Math.min(candidate.parameters.length, 10);
    return score;
}
function parseJavaMethodParameters(input) {
    const parameters = [];
    const rawParameters = splitJavaParameterDeclarations(input);
    for (let index = 0; index < rawParameters.length; index++) {
        const declaration = rawParameters[index]
            .replace(/@\w+(?:\([^)]*\))?\s*/g, "")
            .replace(/\bfinal\s+/g, "")
            .trim();
        if (!declaration) {
            continue;
        }
        const match = declaration.match(/^(.*\S)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
        if (!match) {
            parameters.push({
                name: `arg${index + 1}`,
                type: declaration,
            });
            continue;
        }
        parameters.push({
            name: match[2],
            type: match[1].trim(),
        });
    }
    return parameters;
}
function splitJavaParameterDeclarations(input) {
    const values = [];
    let current = "";
    let angleDepth = 0;
    let roundDepth = 0;
    for (const ch of String(input || "")) {
        if (ch === "<") {
            angleDepth++;
            current += ch;
            continue;
        }
        if (ch === ">") {
            if (angleDepth > 0) {
                angleDepth--;
            }
            current += ch;
            continue;
        }
        if (ch === "(") {
            roundDepth++;
            current += ch;
            continue;
        }
        if (ch === ")") {
            if (roundDepth > 0) {
                roundDepth--;
            }
            current += ch;
            continue;
        }
        if (ch === "," && angleDepth === 0 && roundDepth === 0) {
            if (current.trim()) {
                values.push(current.trim());
            }
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim()) {
        values.push(current.trim());
    }
    return values;
}
function extractCodeRegion(source) {
    const match = source.match(/\/\/ @lc code=start([\s\S]*?)\/\/ @lc code=end/);
    return match ? match[1] : source;
}
function countBraces(line) {
    let delta = 0;
    for (const ch of line) {
        if (ch === "{") {
            delta++;
        }
        else if (ch === "}") {
            delta--;
        }
    }
    return delta;
}
function buildJavaDebugMain(sourceFileName, selectedCase, entryMethodName) {
    return `
import java.lang.reflect.*;
import java.util.*;

public class ${DEBUG_MAIN_CLASS} {
    private static final String SOURCE_FILE = ${toJavaStringLiteral(sourceFileName)};
    private static final String TARGET_METHOD = ${toJavaStringLiteral(entryMethodName || "")};
    private static final String RAW_INPUT = ${toJavaStringLiteral(selectedCase.input || "")};
    private static final String EXPECTED_OUTPUT = ${toJavaStringLiteral(selectedCase.expectedOutput || "")};

    public static void main(String[] args) throws Exception {
        List<String> rawArguments = splitArguments(RAW_INPUT);
        Method target = findTargetMethod(rawArguments.size());
        Object[] parsedArguments = parseArguments(target.getGenericParameterTypes(), rawArguments);

        System.out.println("=== LeetCode Debug ===");
        System.out.println("Source: " + SOURCE_FILE);
        System.out.println("Method: " + target.getName());
        System.out.println("Input:");
        System.out.println(RAW_INPUT);
        if (!EXPECTED_OUTPUT.isEmpty()) {
            System.out.println("Expected:");
            System.out.println(EXPECTED_OUTPUT);
        }

        Solution solution = new Solution();
        Object result = target.invoke(solution, parsedArguments);

        System.out.println("Actual:");
        System.out.println(stringify(result));
    }

    private static Method findTargetMethod(int argumentCount) throws Exception {
        List<Method> candidates = new ArrayList<>();
        for (Method method : Solution.class.getDeclaredMethods()) {
            if (method.isSynthetic() || method.isBridge()) {
                continue;
            }
            if (!TARGET_METHOD.isEmpty() && !method.getName().equals(TARGET_METHOD)) {
                continue;
            }
            candidates.add(method);
        }
        if (candidates.isEmpty()) {
            List<String> availableMethods = new ArrayList<>();
            for (Method method : Solution.class.getDeclaredMethods()) {
                if (method.isSynthetic() || method.isBridge()) {
                    continue;
                }
                availableMethods.add(method.getName() + "/" + method.getParameterCount());
            }
            String loadedFrom = "<unknown>";
            try {
                java.security.CodeSource codeSource = Solution.class.getProtectionDomain().getCodeSource();
                if (codeSource != null && codeSource.getLocation() != null) {
                    loadedFrom = String.valueOf(codeSource.getLocation());
                }
            } catch (Exception ignored) {
            }
            throw new IllegalStateException("Could not find the LeetCode entry method inside Solution. Expected: "
                + (TARGET_METHOD.isEmpty() ? "<auto>" : TARGET_METHOD)
                + "/" + argumentCount
                + ". Available: " + availableMethods
                + ". Loaded from: " + loadedFrom);
        }

        List<Method> matchingByArity = new ArrayList<>();
        for (Method method : candidates) {
            if (method.getParameterCount() == argumentCount) {
                matchingByArity.add(method);
            }
        }
        if (matchingByArity.size() == 1) {
            Method method = matchingByArity.get(0);
            method.setAccessible(true);
            return method;
        }
        if (candidates.size() == 1) {
            Method method = candidates.get(0);
            method.setAccessible(true);
            return method;
        }
        throw new IllegalStateException("Multiple candidate methods were found in Solution. Keep the main LeetCode method first in the class, then retry.");
    }

    private static Object[] parseArguments(Type[] parameterTypes, List<String> rawArguments) {
        if (parameterTypes.length != rawArguments.size()) {
            throw new IllegalArgumentException("Expected " + parameterTypes.length + " arguments but got " + rawArguments.size() + ". Input was: " + RAW_INPUT);
        }
        Object[] parsed = new Object[parameterTypes.length];
        for (int i = 0; i < parameterTypes.length; i++) {
            parsed[i] = parseValue(parameterTypes[i], rawArguments.get(i));
        }
        return parsed;
    }

    private static Object parseValue(Type type, String raw) {
        String text = raw == null ? "" : raw.trim();
        if (type instanceof ParameterizedType) {
            ParameterizedType parameterizedType = (ParameterizedType) type;
            Type rawType = parameterizedType.getRawType();
            if (rawType instanceof Class && List.class.isAssignableFrom((Class<?>) rawType)) {
                Type elementType = parameterizedType.getActualTypeArguments().length > 0 ? parameterizedType.getActualTypeArguments()[0] : Object.class;
                return parseList(elementType, text);
            }
            return parseValue(rawType, text);
        }
        if (type instanceof GenericArrayType) {
            GenericArrayType genericArrayType = (GenericArrayType) type;
            return parseArray(genericArrayType.getGenericComponentType(), text);
        }
        if (!(type instanceof Class)) {
            throw new IllegalArgumentException("Unsupported parameter type: " + type.getTypeName());
        }
        Class<?> clazz = (Class<?>) type;
        if (clazz == String.class) {
            return parseString(text);
        }
        if (clazz == char.class || clazz == Character.class) {
            String value = parseString(text);
            if (value.isEmpty()) {
                throw new IllegalArgumentException("Cannot parse an empty value as char.");
            }
            return value.charAt(0);
        }
        if (clazz == int.class || clazz == Integer.class) {
            return Integer.parseInt(stripQuotes(text));
        }
        if (clazz == long.class || clazz == Long.class) {
            return Long.parseLong(stripQuotes(text));
        }
        if (clazz == double.class || clazz == Double.class) {
            return Double.parseDouble(stripQuotes(text));
        }
        if (clazz == float.class || clazz == Float.class) {
            return Float.parseFloat(stripQuotes(text));
        }
        if (clazz == short.class || clazz == Short.class) {
            return Short.parseShort(stripQuotes(text));
        }
        if (clazz == byte.class || clazz == Byte.class) {
            return Byte.parseByte(stripQuotes(text));
        }
        if (clazz == boolean.class || clazz == Boolean.class) {
            return Boolean.parseBoolean(stripQuotes(text));
        }
        if (clazz.isArray()) {
            return parseArray(clazz.getComponentType(), text);
        }
        if (List.class.isAssignableFrom(clazz)) {
            return parseList(Object.class, text);
        }
        throw new IllegalArgumentException("Unsupported parameter type: " + clazz.getTypeName());
    }

    private static Object parseArray(Type componentType, String raw) {
        List<String> parts = parseArrayItems(raw);
        Class<?> componentClass = toClass(componentType);
        Object array = Array.newInstance(componentClass, parts.size());
        for (int i = 0; i < parts.size(); i++) {
            Array.set(array, i, parseValue(componentType, parts.get(i)));
        }
        return array;
    }

    private static List<Object> parseList(Type elementType, String raw) {
        List<String> parts = parseArrayItems(raw);
        List<Object> values = new ArrayList<>();
        for (String part : parts) {
            values.add(parseValue(elementType, part));
        }
        return values;
    }

    private static List<String> parseArrayItems(String raw) {
        String text = raw == null ? "" : raw.trim();
        if (!text.startsWith("[") || !text.endsWith("]")) {
            throw new IllegalArgumentException("Expected an array-like value but got: " + raw);
        }
        text = text.substring(1, text.length() - 1).trim();
        List<String> items = new ArrayList<>();
        if (text.isEmpty()) {
            return items;
        }
        StringBuilder current = new StringBuilder();
        int depth = 0;
        char quote = 0;
        boolean escaped = false;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (quote != 0) {
                current.append(ch);
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch == '\\\\') {
                    escaped = true;
                    continue;
                }
                if (ch == quote) {
                    quote = 0;
                }
                continue;
            }
            if (ch == '\\'' || ch == '"') {
                quote = ch;
                current.append(ch);
                continue;
            }
            if (ch == '[' || ch == '{' || ch == '(') {
                depth++;
                current.append(ch);
                continue;
            }
            if (ch == ']' || ch == '}' || ch == ')') {
                depth--;
                current.append(ch);
                continue;
            }
            if (ch == ',' && depth == 0) {
                items.add(current.toString().trim());
                current.setLength(0);
                continue;
            }
            current.append(ch);
        }
        if (current.length() > 0) {
            items.add(current.toString().trim());
        }
        return items;
    }

    private static List<String> splitArguments(String rawInput) {
        List<String> arguments = new ArrayList<>();
        if (rawInput == null || rawInput.trim().isEmpty()) {
            return arguments;
        }
        StringBuilder current = new StringBuilder();
        int depth = 0;
        char quote = 0;
        boolean escaped = false;
        for (int i = 0; i < rawInput.length(); i++) {
            char ch = rawInput.charAt(i);
            if (quote != 0) {
                current.append(ch);
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch == '\\\\') {
                    escaped = true;
                    continue;
                }
                if (ch == quote) {
                    quote = 0;
                }
                continue;
            }
            if (ch == '\\'' || ch == '"') {
                quote = ch;
                current.append(ch);
                continue;
            }
            if (ch == '[' || ch == '{' || ch == '(') {
                depth++;
                current.append(ch);
                continue;
            }
            if (ch == ']' || ch == '}' || ch == ')') {
                depth--;
                current.append(ch);
                continue;
            }
            if ((ch == '\\n' || ch == '\\r') && depth == 0) {
                if (current.toString().trim().length() > 0) {
                    arguments.add(current.toString().trim());
                    current.setLength(0);
                }
                continue;
            }
            current.append(ch);
        }
        if (current.toString().trim().length() > 0) {
            arguments.add(current.toString().trim());
        }
        return arguments;
    }

    private static Class<?> toClass(Type type) {
        if (type instanceof Class) {
            return (Class<?>) type;
        }
        if (type instanceof ParameterizedType) {
            return toClass(((ParameterizedType) type).getRawType());
        }
        if (type instanceof GenericArrayType) {
            return Array.newInstance(toClass(((GenericArrayType) type).getGenericComponentType()), 0).getClass();
        }
        return Object.class;
    }

    private static String parseString(String text) {
        String stripped = stripQuotes(text);
        StringBuilder result = new StringBuilder();
        boolean escaped = false;
        for (int i = 0; i < stripped.length(); i++) {
            char ch = stripped.charAt(i);
            if (!escaped) {
                if (ch == '\\\\') {
                    escaped = true;
                    continue;
                }
                result.append(ch);
                continue;
            }
            switch (ch) {
                case 'n':
                    result.append('\\n');
                    break;
                case 'r':
                    result.append('\\r');
                    break;
                case 't':
                    result.append('\\t');
                    break;
                case '\\\\':
                    result.append('\\\\');
                    break;
                case '\\'':
                    result.append('\\'');
                    break;
                case '"':
                    result.append('"');
                    break;
                default:
                    result.append(ch);
                    break;
            }
            escaped = false;
        }
        if (escaped) {
            result.append('\\\\');
        }
        return result.toString();
    }

    private static String stripQuotes(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.trim();
        if (trimmed.length() >= 2) {
            char start = trimmed.charAt(0);
            char end = trimmed.charAt(trimmed.length() - 1);
            if ((start == '"' && end == '"') || (start == '\\'' && end == '\\'')) {
                return trimmed.substring(1, trimmed.length() - 1);
            }
        }
        return trimmed;
    }

    private static String stringify(Object value) {
        if (value == null) {
            return "null";
        }
        Class<?> clazz = value.getClass();
        if (clazz.isArray()) {
            int length = Array.getLength(value);
            List<String> parts = new ArrayList<>();
            for (int i = 0; i < length; i++) {
                parts.add(stringify(Array.get(value, i)));
            }
            return "[" + String.join(", ", parts) + "]";
        }
        if (value instanceof List) {
            List<?> list = (List<?>) value;
            List<String> parts = new ArrayList<>();
            for (Object item : list) {
                parts.add(stringify(item));
            }
            return "[" + String.join(", ", parts) + "]";
        }
        if (value instanceof String) {
            return '"' + value.toString() + '"';
        }
        if (value instanceof Character) {
            return '\\'' + value.toString() + '\\'';
        }
        return value.toString();
    }
}
`.trimStart();
}
function toJavaStringLiteral(value) {
    return `"${String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")}"`;
}
function debugSolutionWithSavedCases(filePath, uri) {
    return __awaiter(this, void 0, void 0, function* () {
        const debugCaseFilePath = getDebugCaseFilePath(filePath);
        const wasCreated = !(yield fse.pathExists(debugCaseFilePath));
        yield ensureDebugCaseFile(filePath, debugCaseFilePath);
        if (wasCreated) {
            yield openDebugCases(uri);
        }
        const cases = yield loadDebugCases(debugCaseFilePath);
        if (!cases.length) {
            yield openDebugCases(uri);
            vscode.window.showInformationMessage("No debug cases were found. Add cases to the .debug.txt file, then run Debug again.");
            return;
        }
        const results = [];
        let stoppedEarlyReason = "";
        yield vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, (progress) => __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < cases.length; i++) {
                const label = `Debug Case ${i + 1}`;
                progress.report({ message: `Running ${label} (${i + 1}/${cases.length})` });
                try {
                    const raw = yield runDebugWithInput(filePath, cases[i].input, progress, label);
                    results.push({
                        label,
                        input: cases[i].input,
                        expectedOutput: cases[i].expectedOutput,
                        raw,
                    });
                }
                catch (error) {
                    const cleanMessage = cleanErrorMessage(error && error.result ? error.result : error);
                    results.push({
                        label,
                        input: cases[i].input,
                        expectedOutput: cases[i].expectedOutput,
                        raw: formatStructuredError(label, cleanMessage),
                    });
                    stoppedEarlyReason = isRateLimitError(error)
                        ? `LeetCode rate limited the remaining debug cases after ${label}.`
                        : `Debugging stopped at ${label}.`;
                    break;
                }
                if (i < cases.length - 1) {
                    progress.report({
                        message: `Waiting ${Math.ceil(INTER_TEST_DELAY_MS / 1000)}s before Debug Case ${i + 2} to avoid rate limits`,
                    });
                    yield sleep(INTER_TEST_DELAY_MS);
                }
            }
        }));
        showResult(formatDebugResults(results, cases.length, stoppedEarlyReason));
    });
}
function handleDebugFailure(error, fallbackMessage) {
    return __awaiter(this, void 0, void 0, function* () {
        const message = cleanErrorMessage(error && error.result ? error.result : error);
        const action = yield vscode.window.showErrorMessage(`${fallbackMessage} ${message}`, "Open Output");
        if (action === "Open Output") {
            yield uiUtils_1.promptForOpenOutputChannel("Open the output channel for detailed debug logs.", uiUtils_1.DialogType.error);
        }
    });
}
function getActiveFilePath(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        if (leetCodeManager_1.leetCodeManager.getStatus() === shared_1.UserStatus.SignedOut) {
            yield uiUtils_1.promptForSignIn();
            return undefined;
        }
        return yield workspaceUtils_1.getActiveFilePath(uri);
    });
}
function isJavaFile(filePath) {
    return path.extname(filePath).toLowerCase() === ".java";
}
function getDebugCaseFilePath(filePath) {
    return path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}${DEBUG_CASE_FILE_SUFFIX}`);
}
function ensureDebugCaseFile(filePath, debugCaseFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield fse.pathExists(debugCaseFilePath)) {
            return;
        }
        const initialContent = yield buildInitialDebugCaseFile(filePath);
        yield fse.outputFile(debugCaseFilePath, initialContent, "utf8");
    });
}
function buildInitialDebugCaseFile(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const examples = yield loadOfficialExamples(filePath);
        const failedCases = yield loadFailedCases(filePath);
        const sections = [
            "# LeetCode Debug Cases",
            "# - Separate cases with ---",
            "# - Input is required",
            "# - Output is optional; when provided, the plugin will compare it with your actual output",
            "",
        ];
        const blocks = [];
        for (const example of examples) {
            blocks.push(formatDebugCaseBlock(example.input, example.output));
        }
        for (const failedCase of failedCases) {
            if (!blocks.some((block) => normalizeTestcase(block).includes(normalizeTestcase(failedCase)))) {
                blocks.push(formatDebugCaseBlock(failedCase));
            }
        }
        if (!blocks.length) {
            blocks.push(formatDebugCaseBlock(""));
        }
        sections.push(blocks.join("\n\n---\n\n"));
        sections.push("");
        return sections.join("\n");
    });
}
function formatDebugCaseBlock(input, output) {
    const lines = ["Input:"];
    if (input) {
        lines.push(input);
    }
    else {
        lines.push("# Paste your testcase here");
    }
    if (output) {
        lines.push("");
        lines.push("Output:");
        lines.push(output);
    }
    return lines.join("\n");
}
function loadOfficialExamples(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const problemId = yield problemUtils_1.getNodeIdFromFile(filePath);
        if (!problemId) {
            return [];
        }
        const description = yield leetCodeExecutor_1.leetCodeExecutor.getDescription(problemId, settingUtils.shouldUseEndpointTranslation());
        const examples = [];
        const exampleReg = /<p><strong class="example">Example\s+\d+:\s*<\/strong><\/p>\s*<pre>([\s\S]*?)<\/pre>/gi;
        let example;
        while ((example = exampleReg.exec(description)) !== null) {
            const inputMatch = example[1].match(/<strong>Input:<\/strong>\s*([\s\S]*?)(?=\s*<strong>Output:<\/strong>)/i);
            const outputMatch = example[1].match(/<strong>Output:<\/strong>\s*([\s\S]*?)(?=\s*<strong>Explanation:<\/strong>|$)/i);
            if (!inputMatch) {
                continue;
            }
            const normalizedInput = normalizeExampleInput(inputMatch[1]);
            if (!normalizedInput) {
                continue;
            }
            const normalizedOutput = outputMatch ? normalizeRichText(outputMatch[1]) : "";
            examples.push({
                input: normalizedInput,
                output: normalizedOutput,
            });
        }
        return examples;
    });
}
function loadFailedCases(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const problemId = yield problemUtils_1.getNodeIdFromFile(filePath);
        if (!problemId) {
            return [];
        }
        return yield customTestcaseStore_1.loadProblemTestcases(filePath, problemId);
    });
}
function loadExistingDebugCases(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const debugCaseFilePath = getDebugCaseFilePath(filePath);
        if (!(yield fse.pathExists(debugCaseFilePath))) {
            return [];
        }
        return yield loadDebugCases(debugCaseFilePath);
    });
}
function loadDebugCases(debugCaseFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = (yield fse.readFile(debugCaseFilePath, "utf8")).replace(/\r\n/g, "\n");
        return raw
            .split(/\n\s*---+\s*\n/g)
            .map((block) => parseDebugCaseBlock(block))
            .filter((debugCase) => !!(debugCase && debugCase.input));
    });
}
function parseDebugCaseBlock(block) {
    const sanitized = String(block || "")
        .split("\n")
        .filter((line) => !line.trim().startsWith("#"))
        .join("\n")
        .trim();
    if (!sanitized) {
        return undefined;
    }
    const inputMatch = sanitized.match(/(?:^|\n)Input:\s*([\s\S]*?)(?=(?:\nOutput:)|$)/i);
    const outputMatch = sanitized.match(/(?:^|\n)Output:\s*([\s\S]*?)$/i);
    if (inputMatch) {
        return {
            input: normalizeTestcase(inputMatch[1]),
            expectedOutput: outputMatch ? normalizeTestcase(outputMatch[1]) : "",
        };
    }
    return {
        input: normalizeTestcase(sanitized),
        expectedOutput: "",
    };
}
function normalizeExampleInput(rawInput) {
    const input = normalizeRichText(rawInput);
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
function normalizeRichText(value) {
    return he.decode(String(value || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, ""))
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]*\n[ \t]*/g, "\n")
        .trim();
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
function runDebugWithInput(filePath, testInput, progress, label) {
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
                        message: `${label} hit rate limit, retrying in ${Math.ceil(RATE_LIMIT_RETRY_DELAYS_MS[attempt] / 1000)}s`,
                    });
                }
                yield sleep(RATE_LIMIT_RETRY_DELAYS_MS[attempt]);
            }
        }
        return "";
    });
}
function formatDebugResults(results, totalCount, stoppedEarlyReason) {
    const passed = results.filter((result) => {
        if (!result.expectedOutput) {
            return false;
        }
        return compareAgainstExpectedOutput(result.raw, result.expectedOutput) === true;
    }).length;
    const comparableCount = results.filter((result) => !!result.expectedOutput).length;
    const processedCount = totalCount || results.length;
    const summaryText = comparableCount
        ? `Debug cases (${passed}/${comparableCount} matched expected output, ${processedCount} run)`
        : `Debug cases (${processedCount} run)`;
    const summaryIcon = stoppedEarlyReason ? "✘" : "✔";
    const lines = [`  ${summaryIcon} ${summaryText}`];
    if (stoppedEarlyReason) {
        lines.push(`  ✘ Notice: ${stoppedEarlyReason}`);
    }
    for (const result of results) {
        const entries = extractMarkedEntries(result.raw);
        const firstMarkedLine = entries[0];
        lines.push(`  ${(firstMarkedLine && firstMarkedLine.icon) || "√"} ${result.label}: ${(firstMarkedLine && firstMarkedLine.text) || "Finished"}`);
        lines.push(`  √ ${result.label} Input: ${result.input}`);
        if (result.expectedOutput) {
            lines.push(`  √ ${result.label} Expected Output: ${result.expectedOutput}`);
        }
        for (const entry of entries) {
            const keyValueMatch = entry.text.match(/^([^:]+):\s*([\s\S]*)$/);
            if (!keyValueMatch) {
                continue;
            }
            const key = keyValueMatch[1];
            const value = keyValueMatch[2];
            if (!value.trim() && key === "Stdout") {
                continue;
            }
            if (key === "Input") {
                continue;
            }
            lines.push(`  ${entry.icon} ${result.label} ${key}: ${value}`);
        }
        if (result.expectedOutput) {
            const compared = compareAgainstExpectedOutput(result.raw, result.expectedOutput);
            if (compared !== undefined) {
                lines.push(`  ${compared ? "✔" : "✘"} ${result.label} Comparison: ${compared ? "PASS" : "FAIL"}`);
            }
        }
    }
    return lines.join("\n");
}
function extractMarkedEntries(raw) {
    const entries = [];
    const normalized = stripAnsi(String(raw || "")).concat("\n  √ ");
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
function compareAgainstExpectedOutput(raw, expectedOutput) {
    const entries = extractMarkedEntries(raw);
    let actualOutput = "";
    for (const entry of entries) {
        const outputMatch = entry.text.match(/^Output(?: \([^)]+\))?:\s*([\s\S]*)$/);
        if (outputMatch && outputMatch[1].trim()) {
            actualOutput = normalizeTestcase(outputMatch[1]);
            break;
        }
    }
    if (!actualOutput) {
        return undefined;
    }
    return actualOutput === normalizeTestcase(expectedOutput);
}
function formatStructuredError(label, message) {
    return `  ✘ ${label}: Test failed\n  ✘ ${label} Error: ${message}`;
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
function stripAnsi(input) {
    return String(input || "").replace(/\u001b\[[0-9;]*m/g, "");
}
function isRateLimitError(error) {
    return !!(error && error.result && /code=429/i.test(String(error.result)));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeTestcase(testcase) {
    return String(testcase || "").replace(/\r\n/g, "\n").trim();
}
function showResult(result) {
    if (!result) {
        return;
    }
    leetCodeSubmissionProvider_1.leetCodeSubmissionProvider.show(result);
}
class UserCancelledError extends Error {
}
