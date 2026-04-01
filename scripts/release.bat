@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0\.."
setlocal

REM Package, publish, or inspect the Marketplace record for this extension.
set ACTION=%1
if "%ACTION%"=="" set ACTION=verify
set EXTENSION_ID=olsonwangyj.leetcode-on-vscode

where vsce >nul 2>nul
if %ERRORLEVEL%==0 (
  set VSCE_CMD=vsce
) else (
  set VSCE_CMD=npx @vscode/vsce
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set VERSION=%%v

echo Extension: %EXTENSION_ID%
echo Version: %VERSION%
echo Action: %ACTION%

if /I "%ACTION%"=="package" (
  %VSCE_CMD% package
  goto :done
)

if /I "%ACTION%"=="publish" (
  %VSCE_CMD% publish
  goto :done
)

if /I "%ACTION%"=="verify" (
  %VSCE_CMD% show %EXTENSION_ID%
  goto :done
)

echo Usage: release.bat [package^|publish^|verify]
exit /b 1

:done
endlocal
exit /b 0

*** Add File: /Users/Zhuanz/.leetcode/leetcodeOnVscode/scripts/build.sh
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
node --check out/src/commands/show.js
node --check out/src/utils/forkConfig.js
node --check out/src/utils/problemWorkspaceLayout.js

echo "Packaging extension..."
"${VSCE_CMD[@]}" package

echo "Build check completed."

*** Add File: /Users/Zhuanz/.leetcode/leetcodeOnVscode/scripts/build.bat
@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0\.."

REM Build check for the packaged JavaScript extension.
REM Prerequisites: Node.js and vsce (or npx @vscode/vsce).

where vsce >nul 2>nul
if %ERRORLEVEL%==0 (
  set VSCE_CMD=vsce
) else (
  set VSCE_CMD=npx @vscode/vsce
)

echo Checking key runtime modules...
node --check out/src/shared.js
if %ERRORLEVEL% neq 0 exit /b 1
node --check out/src/commands/show.js
if %ERRORLEVEL% neq 0 exit /b 1
node --check out/src/utils/forkConfig.js
if %ERRORLEVEL% neq 0 exit /b 1
node --check out/src/utils/problemWorkspaceLayout.js
if %ERRORLEVEL% neq 0 exit /b 1

echo Packaging extension...
%VSCE_CMD% package
if %ERRORLEVEL% neq 0 exit /b 1

echo Build check completed.

*** Add File: /Users/Zhuanz/.leetcode/leetcodeOnVscode/scripts/test.sh
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
}
forbidden_fragments = [
    "out/src/.env.local",
    "out/src/temp.js",
    "resources/AlgoWorkspace",
    "resources/LeetCode.png",
    "resources/LeetCode.svg",
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

*** Add File: /Users/Zhuanz/.leetcode/leetcodeOnVscode/scripts/test.bat
@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0\.."

REM Automated package-content verification for the release artifact.
REM Prerequisites: Node.js, Python 3, and a fresh VSIX from scripts/build.bat.

call scripts\build.bat
if %ERRORLEVEL% neq 0 exit /b 1

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set VERSION=%%v
set VSIX_PATH=leetcode-on-vscode-%VERSION%.vsix

echo Inspecting packaged artifact: %VSIX_PATH%
python -c "import sys, zipfile; path=sys.argv[1]; required={'extension/resources/LeetCodeOnVSCode.png','extension/resources/LeetCodeOnVSCode.svg','extension/resources/LeetCodeOnVSCode-mono.svg'}; forbidden=['out/src/.env.local','out/src/temp.js','resources/AlgoWorkspace','resources/LeetCode.png','resources/LeetCode.svg']; names=set(zipfile.ZipFile(path).namelist()); missing=sorted(required-names); bad=sorted(name for name in names if any(fragment in name for fragment in forbidden)); assert not missing, 'Missing required packaged files: ' + ', '.join(missing); assert not bad, 'Forbidden files still present in package: ' + ', '.join(bad); print('Packaged artifact contents look correct.')" "%VSIX_PATH%"
if %ERRORLEVEL% neq 0 exit /b 1

echo Test check completed.

*** Add File: /Users/Zhuanz/.leetcode/leetcodeOnVscode/scripts/run.sh
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

*** Add File: /Users/Zhuanz/.leetcode/leetcodeOnVscode/scripts/run.bat
@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0\.."

REM Runtime verification by installing the freshly packaged VSIX into VS Code.
REM Prerequisites: VS Code CLI (code) available in PATH.

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set VERSION=%%v
set VSIX_PATH=leetcode-on-vscode-%VERSION%.vsix

if not exist "%VSIX_PATH%" (
  echo Packaged artifact missing. Run scripts\build.bat first.
  exit /b 1
)

echo Installing %VSIX_PATH% into VS Code...
code --install-extension "%VSIX_PATH%" --force
if %ERRORLEVEL% neq 0 exit /b 1

echo Installed extension versions:
code --list-extensions --show-versions | findstr /r "^olsonwangyj\.leetcode-on-vscode@"
if %ERRORLEVEL% neq 0 exit /b 1

echo Runtime check completed.
