# Algo Workspace Companion

Unofficial VS Code fork for solving LeetCode problems with a faster local workflow.

## Important

This extension is an unofficial fork of the open-source `vscode-leetcode` project.

- It is not affiliated with or endorsed by LeetCode.
- It keeps most of the original command IDs and settings for compatibility.
- It is best used as a replacement for the official extension, not side by side with it.

## What This Fork Changes

- Direct test shortcut for faster local iteration.
- Multi-example testing parsed from the problem description.
- Saved failed submission cases reused in later tests.
- More readable submission output formatting.
- Layout tweaks for opening problems and code side by side.
- Auto-closing the previous LeetCode code tab when opening the next problem.

## Current Identity

- Extension ID: `zhuanz.algo-workspace-companion`
- Display name: `Algo Workspace Companion`
- License: MIT

If you want to publish it under your own Marketplace publisher, update the `publisher` field in `package.json` before packaging.

## Packaging

From the extension folder:

```bash
npm install
npx @vscode/vsce package
```

If you already have `vsce` installed globally:

```bash
vsce package
```

## Publish Checklist

- Create your own Visual Studio Marketplace publisher.
- Update `publisher` in `package.json` to match that publisher ID.
- Replace the default fork icon if you want your own branding.
- Review README wording and support links before publishing publicly.
- Package the extension into a `.vsix`.
- Publish with `vsce publish`.

## Notes

- This fork still depends on LeetCode services and your LeetCode account session.
- Public distribution may still carry service-term or brand-review risk, so review LeetCode's terms and your Marketplace listing copy before publishing.

## Upstream Credit

This fork is based on the MIT-licensed upstream project:

- https://github.com/LeetCode-OpenSource/vscode-leetcode

Please keep the original MIT license and attribution when redistributing.
