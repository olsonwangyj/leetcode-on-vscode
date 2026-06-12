# Release Notes

## Current project info

- Local repo: `/Users/Zhuanz/.leetcode/leetcodeOnVscode`
- GitHub repo: `https://github.com/olsonwangyj/leetcode-on-vscode.git`
- Extension id: `olsonwangyj.leetcode-on-vscode`
- Publisher: `olsonwangyj`
- Marketplace item: `https://marketplace.visualstudio.com/items?itemName=olsonwangyj.leetcode-on-vscode`
- Current repo branch: `main`
- Current tracked remote: `origin -> git@github.com:olsonwangyj/leetcode-on-vscode.git`
- Current package version in repo: `1.0.6`
- Installed local extension path pattern: `/Users/Zhuanz/.vscode/extensions/olsonwangyj.leetcode-on-vscode-*`
- Current packaged VSIX files in repo:
  - `leetcode-on-vscode-1.0.6.vsix`

## Current release: 1.0.6

- Adds an automatic LeetCode problem timer.
- Renders the live solving time near `@lc code=start` as `Timer 00:00:00`.
- Adds timer controls in the editor title, top CodeLens, status bar, context menu, and Command Palette.
- Stops the timer on accepted submissions by default and reports the final solving time.
- Updates Marketplace README content with timer, debug, screenshots, and GitHub upload setup.

## One-time setup

Install `vsce`:

```bash
npm install -g @vscode/vsce
```

Login once with the publisher id:

```bash
vsce login olsonwangyj
```

Notes:

- `vsce login` uses the publisher id, not the Marketplace user id.
- If `vsce` says it cannot open the credential store, it stores the token in clear text at `~/.vsce`.
- If a PAT was ever pasted into chat/logs/screenshots, revoke it and create a new one.

## Release flow

### 1. Go to the repo

```bash
cd /Users/Zhuanz/.leetcode/leetcodeOnVscode
```

### 2. Update version

Keep these two files in sync:

- `package.json`
- `package-lock.json`

Current version before the next release: `1.0.6`

### 3. Check local changes

```bash
git status
```

### 4. Package locally

```bash
vsce package
```

This creates a file like:

```bash
leetcode-on-vscode-1.0.6.vsix
```

For the next release, the filename should change with the new version number.

### 5. Publish

```bash
vsce publish
```

### 6. Verify

```bash
vsce show olsonwangyj.leetcode-on-vscode
```

Notes:

- Marketplace pages may lag behind `vsce publish`.
- `vsce publish` returning `DONE Published ...` means the upload succeeded.
- The public item page and gallery API can take a few minutes to catch up.

## Push code to GitHub

```bash
git add .
git commit -m "Your release message"
git push origin main
```

Current remote branch is already:

```bash
main -> origin/main
```

## Useful checks

See current published metadata:

```bash
vsce show olsonwangyj.leetcode-on-vscode
```

Check current git branch status:

```bash
git status --short --branch
```

Use the helper scripts if you want a repeatable workflow:

```bash
./scripts/build.sh
./scripts/test.sh
./scripts/run.sh
./scripts/release.sh package
./scripts/release.sh publish
./scripts/release.sh verify
```

## README / Marketplace Details checklist

Before publishing, check that `README.md` covers both user paths:

- GUI flow: install, LeetCode Activity Bar, sign in, open a problem, test, debug, submit, upload to GitHub.
- Command-line flow: `code --install-extension`, local `.vsix` install, package, verify, and publish.
- Debug flow: Java breakpoint entry, testcase picker, `.debug.txt` reusable case format, JDK / Java Debugger setup.
- Screenshots: `resources/screenshots/leetcode-workflow-annotated.png` and `resources/screenshots/vscode-debug-testcase-picker.png` are real VS Code captures and are included in `vsce ls --tree`.

## Current release-related files

- `package.json`
- `package-lock.json`
- `README.md`
- `resources/screenshots/leetcode-workflow-annotated.png`
- `resources/screenshots/vscode-debug-testcase-picker.png`
- `out/src/commands/debug.js`
- `out/src/codelens/CustomCodeLensProvider.js`

## Known release-related fixes already in the project

- Auth callback uses the new extension id: `olsonwangyj.leetcode-on-vscode`
- Opening a problem auto-collapses the sidebar
- Problem description is on the left and code on the right
- Java debug runs in an isolated runtime so the current problem does not reuse another `Solution.class`
- Marketplace Details now guides both GUI users and command-line users

## Current repo note

- `RELEASE.md` is local documentation and may need to be committed if you want it on GitHub.
- Marketplace detail pages can lag behind a successful `vsce publish`, so prefer `DONE Published ...` as the source of truth immediately after release.
