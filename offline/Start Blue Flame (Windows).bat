@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Blue Flame needs Node.js to run offline. It's free and only takes a minute.
  echo Download it from https://nodejs.org (choose the LTS version), install it,
  echo then double-click this file again.
  echo.
  pause
  exit /b 1
)
node serve.cjs
pause
