@echo off
setlocal
cd /d "%~dp0"
title MediTrack - Running (close this window to stop)

if not exist "node_modules" (
  echo [!] Packages are not installed yet. Running setup first...
  call setup.bat
)

REM Try to start the MongoDB Windows service (needs admin; harmless if already running)
sc query MongoDB 2>nul | find "RUNNING" >nul
if errorlevel 1 net start MongoDB >nul 2>&1

call npm run check

echo Starting backend (5000), React (5173) and Python AI (8000)...
echo Open the exact Local URL printed by Vite in the WEB terminal.
call npm run dev
pause
