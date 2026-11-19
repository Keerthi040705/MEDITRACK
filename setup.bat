@echo off
setlocal
cd /d "%~dp0"
title MediTrack - Setup
echo ==================================================
echo   MediTrack (MERN + Python) - one-time setup
echo ==================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Get the LTS version from https://nodejs.org
  pause
  exit /b 1
)

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo [OK] Created backend\.env from .env.example
)

call npm run setup
if errorlevel 1 (
  echo.
  echo [ERROR] Setup failed - read the messages above.
  pause
  exit /b 1
)

echo.
echo [OK] Setup complete. Now double-click start.bat
pause
