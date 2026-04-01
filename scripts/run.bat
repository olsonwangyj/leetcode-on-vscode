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
