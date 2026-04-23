#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# Build check for the packaged JavaScript extension.
# Prerequisites: Node.js and vsce (or npx @vscode/vsce).

if command -v vsce >/dev/null 2>&1; then
  VSCE_CMD=(vsce)
else
  VSCE_CMD=(npx @vscode/vsce)
fi

echo "Checking key runtime modules..."
node --check out/src/shared.js
node --check out/src/commands/debug.js
node --check out/src/commands/submit.js
node --check out/src/extension.js
node --check out/src/commands/show.js
node --check out/src/utils/forkConfig.js
node --check out/src/utils/problemWorkspaceLayout.js

echo "Packaging extension..."
"${VSCE_CMD[@]}" package

echo "Build check completed."
