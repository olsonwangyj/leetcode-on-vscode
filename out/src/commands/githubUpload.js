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
exports.uploadSolutionsToGitHubBatch = exports.uploadSolutionToGitHub = void 0;
const fse = require("fs-extra");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const LeetCodeNode_1 = require("../explorer/LeetCodeNode");
const explorerNodeManager_1 = require("../explorer/explorerNodeManager");
const leetCodeChannel_1 = require("../leetCodeChannel");
const shared_1 = require("../shared");
const cpUtils_1 = require("../utils/cpUtils");
const problemUtils_1 = require("../utils/problemUtils");
const settingUtils_1 = require("../utils/settingUtils");
const uiUtils_1 = require("../utils/uiUtils");
const defaultCommitMessageTemplate = "Add solution for ${id}. ${name}";
const defaultBatchCommitMessage = "Sync LeetCode solutions";
const ignoredDirectoryNames = new Set([".git", ".vscode", "node_modules"]);
const supportedExtensions = new Set(Array.from(shared_1.langExt.values()).map((ext) => `.${ext.toLowerCase()}`));
const managedRepoParentDir = path.join(os.homedir(), ".leetcode", ".github-solution-repos");
function uploadSolutionToGitHub(input) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const sourceFilePaths = yield resolveSingleSourceFiles(input);
            if (!sourceFilePaths || sourceFilePaths.length === 0) {
                return;
            }
            yield uploadFilesToGitHub(sourceFilePaths, false);
        }
        catch (error) {
            yield handleUploadFailure(error);
        }
    });
}
exports.uploadSolutionToGitHub = uploadSolutionToGitHub;
function uploadSolutionsToGitHubBatch() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const workspaceRoot = yield resolveWorkspaceRoot();
            if (!workspaceRoot) {
                return;
            }
            const sourceFilePaths = yield findSolutionFilesInWorkspace(workspaceRoot);
            if (sourceFilePaths.length === 0) {
                vscode.window.showInformationMessage("No LeetCode solution files were found in the configured workspace.");
                return;
            }
            const confirmation = yield vscode.window.showInformationMessage(`Upload ${sourceFilePaths.length} LeetCode solution file(s) to GitHub?`, uiUtils_1.DialogOptions.yes, uiUtils_1.DialogOptions.no);
            if (confirmation !== uiUtils_1.DialogOptions.yes) {
                return;
            }
            yield uploadFilesToGitHub(sourceFilePaths, true, workspaceRoot);
        }
        catch (error) {
            yield handleUploadFailure(error);
        }
    });
}
exports.uploadSolutionsToGitHubBatch = uploadSolutionsToGitHubBatch;
function resolveSingleSourceFiles(input) {
    return __awaiter(this, void 0, void 0, function* () {
        if (input instanceof LeetCodeNode_1.LeetCodeNode) {
            return yield resolveProblemNodeFiles(input);
        }
        const sourceFilePath = yield getSolutionFilePath(input);
        return sourceFilePath ? [sourceFilePath] : [];
    });
}
function resolveProblemNodeFiles(node) {
    return __awaiter(this, void 0, void 0, function* () {
        const workspaceRoot = yield resolveWorkspaceRoot();
        if (!workspaceRoot) {
            return [];
        }
        const matches = yield findSolutionFilesInWorkspace(workspaceRoot, node.id);
        if (matches.length === 0) {
            vscode.window.showWarningMessage(`No local solution file was found for problem ${node.id}.`);
            return [];
        }
        if (matches.length === 1) {
            return matches;
        }
        const picked = yield vscode.window.showQuickPick(matches.map((filePath) => ({
            label: path.relative(workspaceRoot, filePath),
            description: filePath,
            filePath,
        })), { placeHolder: `Multiple local solution files were found for problem ${node.id}. Select one to upload.` });
        return picked ? [picked.filePath] : [];
    });
}
function getSolutionFilePath(uri) {
    return __awaiter(this, void 0, void 0, function* () {
        let editor;
        if (uri instanceof vscode.Uri) {
            editor = yield vscode.window.showTextDocument(uri, { preview: false });
        }
        else {
            editor = vscode.window.activeTextEditor;
        }
        if (!editor) {
            vscode.window.showWarningMessage("Open a solution file before uploading it to GitHub.");
            return undefined;
        }
        if (editor.document.isDirty && !(yield editor.document.save())) {
            vscode.window.showWarningMessage("Please save the solution file first.");
            return undefined;
        }
        if (editor.document.uri.scheme !== "file") {
            vscode.window.showWarningMessage("Only local solution files can be uploaded to GitHub.");
            return undefined;
        }
        return editor.document.uri.fsPath;
    });
}
function uploadFilesToGitHub(sourceFilePaths, batchMode, workspaceRootOverride) {
    return __awaiter(this, void 0, void 0, function* () {
        const normalizedSourceFilePaths = Array.from(new Set(sourceFilePaths.map((filePath) => path.resolve(filePath))));
        const workspaceRoot = workspaceRootOverride || (yield resolveWorkspaceRoot());
        const targetRepoRoot = yield resolveTargetRepoRoot(normalizedSourceFilePaths[0]);
        if (!targetRepoRoot) {
            return;
        }
        const repoRelativePaths = [];
        for (const sourceFilePath of normalizedSourceFilePaths) {
            const targetFilePath = yield resolveTargetFilePath(sourceFilePath, targetRepoRoot, workspaceRoot);
            const repoRelativePath = getRepoRelativePath(targetRepoRoot, targetFilePath);
            if (path.resolve(sourceFilePath) !== path.resolve(targetFilePath)) {
                yield fse.ensureDir(path.dirname(targetFilePath));
                yield fse.copyFile(sourceFilePath, targetFilePath);
            }
            repoRelativePaths.push(repoRelativePath);
        }
        yield runGitWithProgress(targetRepoRoot, ["add", "--", ...repoRelativePaths], batchMode ? "Staging LeetCode solutions for GitHub..." : "Staging solution for GitHub...");
        if (!(yield hasStagedChanges(targetRepoRoot))) {
            const message = batchMode
                ? "No new solution changes were found to upload."
                : `No new changes to upload for ${repoRelativePaths[0]}.`;
            vscode.window.showInformationMessage(message);
            return;
        }
        const commitMessage = batchMode
            ? getBatchCommitMessage()
            : buildCommitMessage(path.join(targetRepoRoot, repoRelativePaths[0]), targetRepoRoot);
        yield runGitWithProgress(targetRepoRoot, ["commit", "-m", commitMessage], batchMode ? "Creating Git commit for uploaded solutions..." : "Creating Git commit...");
        const autoPushEnabled = settingUtils_1.getWorkspaceConfiguration().get("githubSolutionAutoPush", true);
        const pushed = autoPushEnabled ? yield pushSolutionCommit(targetRepoRoot) : false;
        const successMessage = batchMode
            ? (pushed ? `Uploaded ${repoRelativePaths.length} solution files to GitHub.` : `Committed ${repoRelativePaths.length} solution files locally.`)
            : (pushed ? `Uploaded ${repoRelativePaths[0]} to GitHub.` : `Committed ${repoRelativePaths[0]} locally.`);
        vscode.window.showInformationMessage(successMessage);
    });
}
function resolveTargetRepoRoot(sourceFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const configuration = settingUtils_1.getWorkspaceConfiguration();
        let configuredRepoUrl = (configuration.get("githubSolutionRepo", "") || "").trim();
        let configuredRepoPath = (configuration.get("githubSolutionRepoLocalPath", "") || "").trim();
        if (configuredRepoUrl && !normalizeGitRepositoryUrl(configuredRepoUrl) && (yield isGitRepository(path.resolve(configuredRepoUrl)))) {
            configuredRepoPath = path.resolve(configuredRepoUrl);
            configuredRepoUrl = yield getOriginRemoteUrl(configuredRepoPath);
            if (configuredRepoUrl) {
                yield configuration.update("githubSolutionRepo", configuredRepoUrl, true);
                yield configuration.update("githubSolutionRepoLocalPath", configuredRepoPath, true);
            }
        }
        if (!configuredRepoUrl && configuredRepoPath && (yield isGitRepository(path.resolve(configuredRepoPath)))) {
            return path.resolve(configuredRepoPath);
        }
        if (!configuredRepoUrl) {
            configuredRepoUrl = yield promptForGitHubRepoUrl();
            if (!configuredRepoUrl) {
                return undefined;
            }
            yield configuration.update("githubSolutionRepo", configuredRepoUrl, true);
        }
        const repoRoot = yield ensureManagedGitHubRepo(configuredRepoUrl, configuredRepoPath);
        if (!repoRoot) {
            return undefined;
        }
        if (configuredRepoPath !== repoRoot) {
            yield configuration.update("githubSolutionRepoLocalPath", repoRoot, true);
        }
        return repoRoot;
    });
}
function promptForGitHubRepoUrl() {
    return __awaiter(this, void 0, void 0, function* () {
        const input = yield vscode.window.showInputBox({
            prompt: "Enter the GitHub repository URL used to store your LeetCode solutions.",
            placeHolder: "Example: https://github.com/olsonwangyj/leetcode-solutions.git",
            ignoreFocusOut: true,
            validateInput: (value) => validateGitRepositoryUrl(value),
        });
        if (!input) {
            return undefined;
        }
        return normalizeGitRepositoryUrl(input);
    });
}
function validateGitRepositoryUrl(value) {
    const normalized = normalizeGitRepositoryUrl(value);
    if (!normalized) {
        return "Please enter a valid GitHub repository URL.";
    }
    return undefined;
}
function normalizeGitRepositoryUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
        return "";
    }
    if (/^git@github\.com:[^\\s]+\/[^\\s]+(?:\\.git)?$/i.test(trimmed)) {
        return trimmed;
    }
    try {
        const parsed = new URL(trimmed);
        if (!/^https?:$/i.test(parsed.protocol)) {
            return "";
        }
        if (!/github\.com$/i.test(parsed.hostname)) {
            return "";
        }
        const pathname = parsed.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
        if (!/^[^/]+\/[^/]+(?:\.git)?$/i.test(pathname)) {
            return "";
        }
        return `${parsed.protocol}//${parsed.host}/${pathname}`;
    }
    catch (_a) {
        return "";
    }
}
function ensureManagedGitHubRepo(repoUrl, configuredRepoPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const normalizedRepoUrl = normalizeGitRepositoryUrl(repoUrl);
        if (!normalizedRepoUrl) {
            vscode.window.showErrorMessage("The saved GitHub repository URL is invalid. Please enter it again.");
            yield settingUtils_1.getWorkspaceConfiguration().update("githubSolutionRepo", "", true);
            return undefined;
        }
        let targetRepoRoot = configuredRepoPath ? path.resolve(configuredRepoPath) : getManagedRepoRoot(normalizedRepoUrl);
        if (yield isGitRepository(targetRepoRoot)) {
            yield ensureOriginRemote(targetRepoRoot, normalizedRepoUrl);
            return targetRepoRoot;
        }
        targetRepoRoot = yield findAvailableManagedRepoRoot(targetRepoRoot);
        yield fse.ensureDir(path.dirname(targetRepoRoot));
        yield cpUtils_1.executeCommandWithProgress("Cloning GitHub repository for LeetCode uploads...", "git", ["clone", normalizedRepoUrl, targetRepoRoot], { cwd: path.dirname(targetRepoRoot), shell: false });
        return targetRepoRoot;
    });
}
function getManagedRepoRoot(repoUrl) {
    return path.join(managedRepoParentDir, sanitizeRepoFolderName(repoUrl));
}
function sanitizeRepoFolderName(repoUrl) {
    return normalizeGitRepositoryUrl(repoUrl)
        .replace(/^git@github\.com:/i, "")
        .replace(/^https?:\/\/github\.com\//i, "")
        .replace(/\.git$/i, "")
        .replace(/[\\/:\s]+/g, "__");
}
function findAvailableManagedRepoRoot(basePath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield fse.pathExists(basePath))) {
            return basePath;
        }
        if (yield isGitRepository(basePath)) {
            return basePath;
        }
        for (let suffix = 2; suffix < 1000; suffix++) {
            const candidate = `${basePath}-${suffix}`;
            if (!(yield fse.pathExists(candidate))) {
                return candidate;
            }
            if (yield isGitRepository(candidate)) {
                return candidate;
            }
        }
        throw new Error("Unable to allocate a local folder for the GitHub solution repository.");
    });
}
function ensureOriginRemote(targetRepoRoot, repoUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const existingOrigin = (yield runGit(targetRepoRoot, ["remote", "get-url", "origin"])).trim();
            if (existingOrigin === repoUrl) {
                return;
            }
            yield runGit(targetRepoRoot, ["remote", "set-url", "origin", repoUrl]);
        }
        catch (_a) {
            yield runGit(targetRepoRoot, ["remote", "add", "origin", repoUrl]);
        }
    });
}
function getOriginRemoteUrl(targetRepoRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return normalizeGitRepositoryUrl((yield runGit(targetRepoRoot, ["remote", "get-url", "origin"])).trim());
        }
        catch (_a) {
            return "";
        }
    });
}
function resolveTargetFilePath(sourceFilePath, targetRepoRoot, workspaceRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        const normalizedSourcePath = path.resolve(sourceFilePath);
        const normalizedTargetRepoRoot = path.resolve(targetRepoRoot);
        if (isSameOrSubPath(normalizedSourcePath, normalizedTargetRepoRoot)) {
            return normalizedSourcePath;
        }
        if (workspaceRoot) {
            const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
            if (isSameOrSubPath(normalizedSourcePath, normalizedWorkspaceRoot)) {
                return path.join(normalizedTargetRepoRoot, path.relative(normalizedWorkspaceRoot, normalizedSourcePath));
            }
        }
        return path.join(normalizedTargetRepoRoot, path.basename(normalizedSourcePath));
    });
}
function getRepoRelativePath(targetRepoRoot, targetFilePath) {
    const relativePath = path.relative(targetRepoRoot, targetFilePath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`Failed to map ${targetFilePath} into the git repository ${targetRepoRoot}.`);
    }
    return relativePath;
}
function buildCommitMessage(targetFilePath, targetRepoRoot) {
    const template = settingUtils_1.getWorkspaceConfiguration().get("githubSolutionCommitMessage", defaultCommitMessageTemplate);
    const fileName = path.basename(targetFilePath);
    const ext = path.extname(fileName).replace(/^\./, "");
    const nameSegments = fileName.split(".");
    const id = nameSegments[0] || fileName;
    const slug = nameSegments.length > 2 ? nameSegments.slice(1, -1).join(".") : path.basename(fileName, path.extname(fileName));
    const readableName = slug
        .split(/[-_.]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
    const relativePath = getRepoRelativePath(targetRepoRoot, targetFilePath).split(path.sep).join("/");
    return template
        .replace(/\$\{id\}/g, id)
        .replace(/\$\{name\}/g, readableName || fileName)
        .replace(/\$\{fileName\}/g, fileName)
        .replace(/\$\{slug\}/g, slug)
        .replace(/\$\{relativePath\}/g, relativePath)
        .replace(/\$\{ext\}/g, ext);
}
function getBatchCommitMessage() {
    return settingUtils_1.getWorkspaceConfiguration().get("githubSolutionBatchCommitMessage", defaultBatchCommitMessage);
}
function pushSolutionCommit(targetRepoRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield runGitWithProgress(targetRepoRoot, ["push"], "Pushing solution to GitHub...");
            return true;
        }
        catch (_a) {
            try {
                yield runGitWithProgress(targetRepoRoot, ["push", "-u", "origin", "HEAD"], "Pushing solution to GitHub...");
                return true;
            }
            catch (error) {
                leetCodeChannel_1.leetCodeChannel.appendLine(error.toString());
                vscode.window.showWarningMessage("The solution commit was created locally, but pushing to GitHub failed. Please check your remote and credentials.");
                return false;
            }
        }
    });
}
function hasStagedChanges(targetRepoRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        const stagedFiles = yield runGit(targetRepoRoot, ["diff", "--cached", "--name-only"]);
        return stagedFiles.trim().length > 0;
    });
}
function isGitRepository(folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return Boolean(yield getGitRepositoryRoot(folderPath));
    });
}
function getGitRepositoryRoot(folderPath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const result = yield runGit(folderPath, ["rev-parse", "--show-toplevel"]);
            return result.trim();
        }
        catch (_a) {
            return undefined;
        }
    });
}
function runGit(targetRepoRoot, args) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield cpUtils_1.executeCommand("git", args, { cwd: targetRepoRoot, shell: false });
    });
}
function runGitWithProgress(targetRepoRoot, args, message) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield cpUtils_1.executeCommandWithProgress(message, "git", args, { cwd: targetRepoRoot, shell: false });
    });
}
function handleUploadFailure(error) {
    return __awaiter(this, void 0, void 0, function* () {
        leetCodeChannel_1.leetCodeChannel.appendLine(error.toString());
        yield uiUtils_1.promptForOpenOutputChannel("Failed to upload the solution to GitHub. Please open the output channel for details.", uiUtils_1.DialogType.error);
    });
}
function resolveWorkspaceRoot() {
    return __awaiter(this, void 0, void 0, function* () {
        const configuredWorkspace = (settingUtils_1.getWorkspaceFolder() || "").trim();
        if (configuredWorkspace) {
            return path.resolve(configuredWorkspace);
        }
        const workspaceFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        if (workspaceFolder) {
            return workspaceFolder.uri.fsPath;
        }
        const selectedDirectories = yield uiUtils_1.showDirectorySelectDialog();
        if (!selectedDirectories || selectedDirectories.length < 1) {
            return undefined;
        }
        const selectedWorkspace = selectedDirectories[0].fsPath;
        yield settingUtils_1.getWorkspaceConfiguration().update("workspaceFolder", selectedWorkspace, true);
        return selectedWorkspace;
    });
}
function findSolutionFilesInWorkspace(workspaceRoot, problemId) {
    return __awaiter(this, void 0, void 0, function* () {
        const matches = [];
        const directories = [workspaceRoot];
        while (directories.length > 0) {
            const currentDirectory = directories.pop();
            const entries = yield fse.readdir(currentDirectory, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDirectory, entry.name);
                if (entry.isDirectory()) {
                    if (!ignoredDirectoryNames.has(entry.name)) {
                        directories.push(fullPath);
                    }
                    continue;
                }
                if (!(yield isCandidateSolutionFile(fullPath, problemId))) {
                    continue;
                }
                matches.push(fullPath);
            }
        }
        return matches.sort((left, right) => left.localeCompare(right));
    });
}
function isCandidateSolutionFile(filePath, problemId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!supportedExtensions.has(path.extname(filePath).toLowerCase())) {
            return false;
        }
        const baseName = path.basename(filePath);
        if (!/^\d+/.test(baseName)) {
            return false;
        }
        const detectedId = yield problemUtils_1.getNodeIdFromFile(filePath);
        if (!detectedId) {
            return false;
        }
        if (problemId && detectedId !== problemId) {
            return false;
        }
        return Boolean(explorerNodeManager_1.explorerNodeManager.getNodeById(detectedId) || /^\d+$/.test(detectedId));
    });
}
function isSameOrSubPath(candidatePath, rootPath) {
    const relativePath = path.relative(rootPath, candidatePath);
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
