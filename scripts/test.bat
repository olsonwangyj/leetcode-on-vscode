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
