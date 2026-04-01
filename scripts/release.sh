#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# Package, publish, or inspect the Marketplace record for this extension.
ACTION="${1:-verify}"
EXTENSION_ID="olsonwangyj.leetcode-on-vscode"

if command -v vsce >/dev/null 2>&1; then
  VSCE_CMD=(vsce)
else
  VSCE_CMD=(npx @vscode/vsce)
fi

VERSION="$(node -p "require('./package.json').version")"

echo "Extension: ${EXTENSION_ID}"
echo "Version: ${VERSION}"
echo "Action: ${ACTION}"

case "$ACTION" in
  package)
    "${VSCE_CMD[@]}" package
    ;;
  publish)
    "${VSCE_CMD[@]}" publish
    ;;
  verify)
    "${VSCE_CMD[@]}" show "${EXTENSION_ID}"
    ;;
  *)
    echo "Usage: $0 [package|publish|verify]"
    exit 1
    ;;
esac
