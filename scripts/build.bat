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
