#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# Runtime verification by installing the freshly packaged VSIX into VS Code.
# Prerequisites: VS Code CLI (`code`) available in PATH.

VERSION="$(node -p "require('./package.json').version")"
VSIX_PATH="leetcode-on-vscode-${VERSION}.vsix"

if [ ! -f "$VSIX_PATH" ]; then
  echo "Packaged artifact missing. Run scripts/build.sh first."
  exit 1
fi

echo "Installing ${VSIX_PATH} into VS Code..."
code --install-extension "$VSIX_PATH" --force

echo "Installed extension versions:"
code --list-extensions --show-versions | grep '^olsonwangyj.leetcode-on-vscode@'

echo "Runtime check completed."
