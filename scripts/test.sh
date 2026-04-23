#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# Automated package-content verification for the release artifact.
# Prerequisites: Node.js, Python 3, and a fresh VSIX from scripts/build.sh.

./scripts/build.sh

VERSION="$(node -p "require('./package.json').version")"
VSIX_PATH="leetcode-on-vscode-${VERSION}.vsix"

echo "Inspecting packaged artifact: ${VSIX_PATH}"
python3 - "$VSIX_PATH" <<'PY'
import sys
import zipfile

vsix_path = sys.argv[1]
required = {
    "extension/resources/LeetCodeOnVSCode.png",
    "extension/resources/LeetCodeOnVSCode.svg",
    "extension/resources/LeetCodeOnVSCode-mono.svg",
    "extension/out/src/commands/debug.js",
}
forbidden_fragments = [
    "out/src/.env.local",
    "out/src/temp.js",
    "resources/AlgoWorkspace",
    "resources/LeetCode.png",
    "resources/LeetCode.svg",
    "extension/debug.js",
    "extension/smoke/",
]

with zipfile.ZipFile(vsix_path) as archive:
    names = set(archive.namelist())
    missing = sorted(item for item in required if item not in names)
    forbidden = sorted(
        name for name in names
        if any(fragment in name for fragment in forbidden_fragments)
    )

if missing:
    print("Missing required packaged files:")
    for item in missing:
        print(f"  - {item}")
    sys.exit(1)

if forbidden:
    print("Forbidden files still present in package:")
    for item in forbidden:
        print(f"  - {item}")
    sys.exit(1)

print("Packaged artifact contents look correct.")
PY

echo "Test check completed."
