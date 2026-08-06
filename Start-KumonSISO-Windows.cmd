@echo off
title Kumon SISO - Student Check-In & Pickup System
cd /d "%~dp0"

echo ===================================================
echo   Kumon SISO - Starting Application Services...
echo ===================================================

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

:: Auto-install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] First-time setup detected. Installing packages...
    call npm install
)

:: Auto-build packages if dist is missing
if not exist "packages\shared\dist\" (
    echo [INFO] Building application packages...
    call npm run build
)

:: Start local server in background window
echo [INFO] Starting Kumon SISO Local Server...
start "Kumon SISO Server" /min cmd /c "npm run start:server"

:: Start desktop admin UI
start "" "http://localhost:3000/api/health"
timeout /t 2 /nobreak >nul

:: Open Desktop Admin and Check-In PWA in default browser
echo [INFO] Opening Desktop Admin Console...
start "" "http://localhost:5174"
start "" "http://localhost:5173"

echo.
echo ===================================================
echo   Kumon SISO is now running!
echo   Desktop Admin: http://localhost:5174
echo   Check-In PWA:  http://localhost:5173
echo ===================================================
echo.
