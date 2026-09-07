@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "WORLD_NODE=node"
where node.exe >nul 2>nul
if errorlevel 1 set "WORLD_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not "%WORLD_NODE%"=="node" if not exist "%WORLD_NODE%" (
  echo 未找到本机 Node.js，请在 Codex 中打开网站工程后重新检查运行环境。
  pause
  exit /b 1
)
"%WORLD_NODE%" scripts\publish.mjs %*
set "WORLD_EXIT=%errorlevel%"
pause
exit /b %WORLD_EXIT%
